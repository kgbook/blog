+++
title = "一次 Android NDK 链接失败：让 CMake 正确传递 object library 对象文件"
date = 2026-06-06

[taxonomies]
categories = ["Android"]
tags = ["Android", "NDK", "CMake", "C++", "Object Library", "构建系统"]
+++

## 一、问题背景

APlay 的 C++ SDK 通过一层 Android.mk 风格的 `CMakeHelper` 来组织模块。业务侧不用直接写 `add_library()`、`target_link_libraries()`，而是用 `LOCAL_MODULE`、`LOCAL_INTERFACE_LIBRARIES`、`LOCAL_OBJECT_LIBRARIES` 这类变量描述 target 关系。

Android SDK 的 JNI 入口目标是 `APlaySdk`，它依赖统一的 C++ SDK 聚合目标：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE APlaySdk)
set(LOCAL_SRC_DIRS ${CMAKE_CURRENT_LIST_DIR})
set(LOCAL_INTERFACE_LIBRARIES cpp_sdk)
set(LOCAL_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})
include(${BUILD_SHARED_LIBRARY})
```

`cpp_sdk` 又会继续依赖 `core`，`core` 里包含 `runtime`：

```cmake
set(LOCAL_MODULE core)
set(LOCAL_INTERFACE_LIBRARIES
    pattern
    eventloop
    network
    poll
    runtime
    thread
    module)
```

`runtime` 是一个 object library，里面定义了 JNI 入口直接调用的 C API：

```cpp
extern "C" const char* aplay_sdk_version();
extern "C" const char* aplay_sdk_default_receiver_name();
```

编译 Android Debug 包时，C++ 源码能正常编译，但最终链接 `libAPlaySdk.so` 失败：

```text
ld: error: undefined symbol: aplay_sdk_version
>>> referenced by native_entry.cpp

ld: error: undefined symbol: aplay_sdk_default_receiver_name
>>> referenced by native_entry.cpp
```

表面看是符号缺失，实际是构建系统没有把 `runtime` 这个 object library 的对象文件带进最终 `.so`。

## 二、先看链接命令

定位链接问题时，第一步不要先猜 C++ 代码，而是看最终链接命令。

失败日志里 `libAPlaySdk.so` 的输入大致是这样：

```text
clang++ -shared -o osal/android/jni/libAPlaySdk.so
  osal/android/jni/CMakeFiles/APlaySdk.dir/native_entry.cpp.o
  core/eventloop/libeventloop.a
  core/thread/libthread.a
  libSpdlogHelper.so
  libspdlogd.a
  xdebug/libxdebug.so
```

这里能看到 `native_entry.cpp.o`，也能看到部分静态库和动态库，但没有看到：

```text
core/runtime/CMakeFiles/runtime.dir/src/sdk.cpp.o
```

这就解释了为什么 `aplay_sdk_version()` 和 `aplay_sdk_default_receiver_name()` 找不到。它们在 `sdk.cpp` 里定义，但 `sdk.cpp.o` 根本没有进入链接输入。

## 三、为什么 include 能找到，链接却失败

这个问题容易误判，因为 `native_entry.cpp` 里的头文件是能找到的：

```cpp
#include "sdk.h"
```

能找到头文件只说明 `runtime` 的 `LOCAL_EXPORT_C_INCLUDES` 被传递到了消费者。它不等价于实现文件也参与链接。

在 CMake 里，object library 有一个很特殊的性质：它不是普通的 `.a` 或 `.so`，不会天然作为一个可链接产物出现在最终命令里。要让它的对象文件进入消费者，通常要显式使用：

```cmake
$<TARGET_OBJECTS:runtime>
```

也就是说，object library 的 include、compile definition、依赖关系可以通过 `target_link_libraries()` 传播，但它编译出来的 `.o` 是否进入最终产物，需要构建系统额外处理。

## 四、依赖链的问题点

这次的真实依赖链是：

```text
APlaySdk -> cpp_sdk -> core -> runtime
```

其中：

- `APlaySdk` 是 shared library。
- `cpp_sdk` 是 interface library。
- `core` 是 interface library。
- `runtime` 是 object library。

旧版 `CMakeHelper` 只在一种情况下会把对象文件发布出去：interface library 直接声明了 `LOCAL_OBJECT_LIBRARIES`。

简化后的旧逻辑类似这样：

```cmake
foreach(LOCAL_OBJECT_LIBRARY IN LISTS LOCAL_OBJECT_LIBRARIES)
    target_sources(${LOCAL_MODULE}
        INTERFACE
            $<TARGET_OBJECTS:${LOCAL_OBJECT_LIBRARY}>)
endforeach()
```

这个逻辑能处理：

```text
some_interface -> runtime
```

但处理不了：

```text
APlaySdk -> cpp_sdk -> core -> runtime
```

因为 `runtime` 在 `core` 里是通过 `LOCAL_INTERFACE_LIBRARIES` 声明的，不在 `LOCAL_OBJECT_LIBRARIES` 列表里。于是依赖关系能传下去，对象文件没有传下去。

临时修复很简单：给 Android JNI 目标直接加一行。

```cmake
set(LOCAL_OBJECT_LIBRARIES runtime)
```

这能让 Android 构建通过，但它不是根因修复。因为 Harmony NAPI、Linux native，或者后续任何 shared library 只要通过 interface 链间接依赖 object library，都可能再次踩坑。

## 五、从 CMakeHelper 层修复

根因在构建 helper，所以修复也应该放在 `CMakeHelper` 层。

新增一个内部函数：遍历当前 target 的依赖列表，如果某个依赖 target 的类型是 `OBJECT_LIBRARY`，就把它的 `$<TARGET_OBJECTS:...>` 加到当前 target 的 sources。

核心逻辑如下：

```cmake
function(publish_local_object_sources LOCAL_TARGET LOCAL_VISIBILITY)
    set(LOCAL_OBJECT_SOURCE_LIBRARIES)

    foreach(LOCAL_DEPENDENCY IN LISTS ARGN)
        if(TARGET ${LOCAL_DEPENDENCY})
            get_target_property(LOCAL_DEPENDENCY_TYPE ${LOCAL_DEPENDENCY} TYPE)
            if(LOCAL_DEPENDENCY_TYPE STREQUAL "OBJECT_LIBRARY")
                list(APPEND LOCAL_OBJECT_SOURCE_LIBRARIES ${LOCAL_DEPENDENCY})
            endif()
        endif()
    endforeach()

    if(LOCAL_OBJECT_SOURCE_LIBRARIES)
        list(REMOVE_DUPLICATES LOCAL_OBJECT_SOURCE_LIBRARIES)
    endif()

    foreach(LOCAL_OBJECT_SOURCE_LIBRARY IN LISTS LOCAL_OBJECT_SOURCE_LIBRARIES)
        target_sources(${LOCAL_TARGET}
            ${LOCAL_VISIBILITY}
                $<TARGET_OBJECTS:${LOCAL_OBJECT_SOURCE_LIBRARY}>)
    endforeach()
endfunction()
```

然后在各种 `BUILD_*` 入口里统一调用。

对于最终会生成实体产物的 target，比如 shared library、static library、executable，对象文件应该直接进入当前产物，所以使用 `PRIVATE`：

```cmake
publish_local_object_sources(${LOCAL_MODULE} PRIVATE ${LOCAL_DEPENDENCIES})
```

对于 interface library 和 object library，它们本身不是最终链接产物，更多是在表达使用规则，所以使用 `INTERFACE` 继续向下游发布：

```cmake
publish_local_object_sources(${LOCAL_MODULE} INTERFACE ${LOCAL_DEPENDENCIES})
```

这样以后不管依赖链是：

```text
shared -> object
```

还是：

```text
shared -> interface -> interface -> object
```

最终 shared library 都能拿到 object library 的 `.o` 输入。

## 六、为什么不是只改业务 CMakeLists

只在 `APlaySdk` 里补 `runtime` 有两个问题。

第一，它会破坏模块边界。`APlaySdk` 本来只需要依赖 `cpp_sdk`，不应该知道 `core` 下面具体有哪些 object library。

第二，它会让同类问题反复出现。只要另一个平台入口也通过 `cpp_sdk -> core -> runtime` 调用 runtime API，就还要再补一次。

构建系统的职责是把声明出来的依赖关系翻译成正确的编译和链接输入。如果 `core` 已经声明依赖 `runtime`，那么最终消费者就不应该再手工补底层模块名。

## 七、验证方式

这个问题的验证不只看构建是否成功，还要看链接输入是否符合预期。

修复前，`libAPlaySdk.so` 链接命令里没有：

```text
core/runtime/CMakeFiles/runtime.dir/src/sdk.cpp.o
```

修复后，重新配置并构建 Android SDK，`runtime` 的对象文件会沿着 `core -> cpp_sdk -> APlaySdk` 传递到最终 shared library，`aplay_sdk_version` 和 `aplay_sdk_default_receiver_name` 的 undefined symbol 消失。

如果以后遇到类似问题，可以按这个顺序排查：

1. 用完整构建日志确认 undefined symbol 来自哪个 `.cpp`。
2. 用 `rg` 搜索符号定义在哪个源文件。
3. 检查最终链接命令里是否包含这个源文件对应的 `.o`、`.a` 或 `.so`。
4. 回到 CMake target 依赖链，确认对象文件是否被显式或间接发布。

## 八、结论

这次问题不是 C++ API 定义缺失，也不是 JNI 声明错误，而是 object library 的对象文件没有沿 interface 依赖链传播。

修复点放在 `CMakeHelper` 之后，业务模块仍然可以保持干净的依赖声明：

```cmake
set(LOCAL_INTERFACE_LIBRARIES cpp_sdk)
```

底层 helper 负责把 `cpp_sdk -> core -> runtime` 这条链翻译成正确的链接输入。这样既修复了 Android NDK 链接问题，也让后续跨平台 C++ 模块复用同一套构建规则时更可靠。
