+++
title = "用 Android.mk 的写法组织 CMake：让跨平台 C++ 构建更像填表"
date = 2026-06-04

[taxonomies]
categories = ["Android"]
tags = ["CMake", "C++", "跨平台构建", "Android.mk"]
+++

## 一、为什么要再封一层 CMake

CMake 很强，但刚开始接触时也很容易写乱。

比如我们想做一件很普通的事：写一个 `hello` object library，再写一个 `hello_world` 可执行程序去使用它。原生 CMake 可能会这样写：

```cmake
add_library(hello OBJECT hello/src/hello.cpp)
target_include_directories(hello PUBLIC hello/include)

add_executable(hello_world example/src/main.cpp)
target_link_libraries(hello_world PRIVATE hello)
```

这段代码不难，但项目一大，问题就来了：

- 每个 target 都要重复写 include、依赖、输出属性。
- 有人用 `PUBLIC`，有人用 `PRIVATE`，规则容易不统一。
- interface library、object library、静态库、动态库、可执行程序、预编译库的写法分散在各处。
- 新人读 CMakeLists 时，很难一眼看出“这个模块叫什么、有哪些源码、依赖谁”。

所以我们可以给 CMake 加一层很薄的约定。底层仍然是标准 CMake，外层换成更规整的声明方式。

这次的思路借鉴 Android.mk 的命名风格：用 `LOCAL_MODULE`、`LOCAL_SRC_FILES`、`LOCAL_SRC_DIRS` 这些变量描述当前模块，再通过 `BUILD_INTERFACE_LIBRARY`、`BUILD_OBJECT_LIBRARY`、`BUILD_EXECUTABLE` 这样的入口真正创建 target。

注意，这不是 Android 专用方案。它只是借用了 Android.mk 的“填表式”命名方式，本质仍然是跨平台 CMake。你可以把它用在 Linux、RISC-V、桌面端、嵌入式系统等不同平台里。

## 二、Android.mk 风格到底像什么

如果把一个 C++ target 想象成一张表，最重要的信息其实就几项：

- 这个模块叫什么。
- 它有哪些源码。
- 它要暴露哪些头文件目录。
- 它依赖哪些库。
- 它最终要生成 interface library、object library、静态库、动态库，还是可执行程序。

Android.mk 风格就是把这些信息拆成一组 `LOCAL_*` 变量。

例如先声明一个只负责导出头文件目录的 interface library：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE hello_headers)
set(LOCAL_EXPORT_C_INCLUDES
    ${CMAKE_CURRENT_LIST_DIR}/include)
include(${BUILD_INTERFACE_LIBRARY})
```

再声明真正编译源码的 object library：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE hello)
set(LOCAL_SRC_DIRS
    ${CMAKE_CURRENT_LIST_DIR}/src)
set(LOCAL_INTERFACE_LIBRARIES
    hello_headers)
include(${BUILD_OBJECT_LIBRARY})
```

这段可以按自然语言读出来：

第一段可以读成：“当前模块叫 `hello_headers`。它不编译源码，只把 `include` 目录作为接口导出去。”

第二段可以读成：“当前模块叫 `hello`。源码从 `src` 目录自动收集。它依赖 `hello_headers` 这个接口模块。最后把它构建成 object library。”

再看一个可执行程序：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE hello_world)
set(LOCAL_SRC_FILES
    src/main.cpp)
set(LOCAL_OBJECT_LIBRARIES
    hello)
include(${BUILD_EXECUTABLE})
```

它的意思也很直接：

“当前模块叫 `hello_world`。源码是 `src/main.cpp`。它使用 object library `hello`。最后把它构建成可执行程序。”

这就是这种写法的核心价值：不要求读者先理解很多 CMake 细节，也能先看懂模块结构。

## 三、每个变量负责什么

下面用更小白一点的方式解释这些变量。

### `CLEAR_VARS`

每写一个模块前都先：

```cmake
include(${CLEAR_VARS})
```

它的作用是清空上一轮的 `LOCAL_*` 变量。

如果不清空，前一个模块的源码、依赖、头文件目录可能会“串”到下一个模块里。Android.mk 里也有类似习惯：每个模块开始前先清场。

### `LOCAL_MODULE`

```cmake
set(LOCAL_MODULE hello)
```

它就是 CMake target 的名字。后面别的模块要依赖它，也用这个名字。

例如：

```cmake
set(LOCAL_STATIC_LIBRARIES
    hello)
```

### `LOCAL_SRC_FILES`

```cmake
set(LOCAL_SRC_FILES
    src/hello.cpp
    src/message.cpp)
```

这里放源码文件。静态库、动态库、可执行程序都需要它。

### `LOCAL_SRC_DIRS`

```cmake
set(LOCAL_SRC_DIRS
    ${CMAKE_CURRENT_LIST_DIR}/src/hello
    ${CMAKE_CURRENT_LIST_DIR}/src/common)
```

当一个模块里 `.cpp` 文件很多时，不想在 `LOCAL_SRC_FILES` 里一行一行写文件名，就可以用 `LOCAL_SRC_DIRS`。

它的内部实现使用 CMake 的 `aux_source_directory`。简单理解就是：“把这个目录当前层里的源码文件收集起来，追加到 `LOCAL_SRC_FILES`。”

需要注意两点：

- 它只收集指定目录当前层，不递归进入子目录。
- 如果某些文件是特殊平台才编译，仍然建议手动放到 `LOCAL_SRC_FILES`，或者用 `if()` 判断后再追加。

`LOCAL_SRC_FILES` 和 `LOCAL_SRC_DIRS` 可以一起用：

```cmake
set(LOCAL_SRC_DIRS
    ${CMAKE_CURRENT_LIST_DIR}/src/core)
set(LOCAL_SRC_FILES
    ${CMAKE_CURRENT_LIST_DIR}/src/platform/linux_entry.cpp)
```

### `LOCAL_C_INCLUDES`

```cmake
set(LOCAL_C_INCLUDES
    ${CMAKE_CURRENT_LIST_DIR}/private_include)
```

这是当前模块自己使用的头文件目录。它不会自动传给依赖它的模块。

可以把它理解成“私有 include”。

### `LOCAL_EXPORT_C_INCLUDES`

```cmake
set(LOCAL_EXPORT_C_INCLUDES
    ${CMAKE_CURRENT_LIST_DIR}/include)
```

这是当前模块对外暴露的头文件目录。

比如 `hello` 库提供了 `include/hello/hello.hpp`，那么 `hello_world` 链接 `hello` 后，也应该能包含这个头文件。这种目录就放到 `LOCAL_EXPORT_C_INCLUDES`。

可以把它理解成“公开 include”。

### `LOCAL_STATIC_LIBRARIES`、`LOCAL_SHARED_LIBRARIES`、`LOCAL_INTERFACE_LIBRARIES` 和 `LOCAL_OBJECT_LIBRARIES`

```cmake
set(LOCAL_STATIC_LIBRARIES
    hello)
```

这里写依赖的库 target。

`LOCAL_STATIC_LIBRARIES` 用来表达静态库依赖，`LOCAL_SHARED_LIBRARIES` 用来表达动态库依赖。底层实现会把它们转成 CMake 的 `target_link_libraries`。

如果依赖的是 interface library，就放到 `LOCAL_INTERFACE_LIBRARIES`：

```cmake
set(LOCAL_INTERFACE_LIBRARIES
    hello_headers)
```

interface library 通常不产生 `.a`、`.so` 或可执行文件，它更像一组“使用规则”：头文件目录、编译定义、或者继续依赖的其他 target。

如果模块是 object library，就放到 `LOCAL_OBJECT_LIBRARIES`：

```cmake
set(LOCAL_OBJECT_LIBRARIES
    hello)
```

这样既能使用 object library 的对象文件，也能继承它对外暴露的 include 目录。

### `BUILD_*`

最后一步用 `BUILD_*` 决定生成什么：

```cmake
include(${BUILD_STATIC_LIBRARY})
include(${BUILD_SHARED_LIBRARY})
include(${BUILD_INTERFACE_LIBRARY})
include(${BUILD_OBJECT_LIBRARY})
include(${BUILD_EXECUTABLE})
include(${BUILD_PREBUILT})
```

这一步才是真正创建 CMake target 的地方。

前面的 `LOCAL_*` 是填表，最后的 `BUILD_*` 是提交表单。

## 四、一个完整 hello world

目录结构如下：

```text
hello/
├── CMakeLists.txt
├── include/
│   └── hello/
│       └── hello.hpp
└── src/
    └── hello.cpp

example/
├── CMakeLists.txt
└── src/
    └── main.cpp
```

`hello.hpp`：

```cpp
#pragma once

#include <string>
#include <string_view>

namespace hello {

std::string message(std::string_view name);

}
```

`hello.cpp`：

```cpp
#include "hello/hello.hpp"

namespace hello {

std::string message(std::string_view name)
{
    return "Hello, " + std::string(name) + "!";
}

}
```

`main.cpp`：

```cpp
#include "hello/hello.hpp"

#include <iostream>
#include <string_view>

namespace {

constexpr std::string_view default_name()
{
    if constexpr (sizeof(void*) >= 8) {
        return "world";
    } else {
        return "embedded world";
    }
}

}

int main()
{
    std::cout << hello::message(default_name()) << '\n';
    return 0;
}
```

`hello/CMakeLists.txt`：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE hello_headers)
set(LOCAL_EXPORT_C_INCLUDES
    ${CMAKE_CURRENT_LIST_DIR}/include)
include(${BUILD_INTERFACE_LIBRARY})

include(${CLEAR_VARS})
set(LOCAL_MODULE hello)
set(LOCAL_SRC_DIRS
    ${CMAKE_CURRENT_LIST_DIR}/src)
set(LOCAL_INTERFACE_LIBRARIES
    hello_headers)
include(${BUILD_OBJECT_LIBRARY})
```

`example/CMakeLists.txt`：

```cmake
include(${CLEAR_VARS})
set(LOCAL_MODULE hello_world)
set(LOCAL_SRC_FILES
    src/main.cpp)
set(LOCAL_OBJECT_LIBRARIES
    hello)
include(${BUILD_EXECUTABLE})
```

根目录 `CMakeLists.txt` 只需要先引入 helper，再加入模块和 example：

```cmake
cmake_minimum_required(VERSION 3.16)

project(CMakeHelper
    VERSION 0.1.0
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(${CMAKE_CURRENT_LIST_DIR}/cmake/CMakeHelper.cmake)

option(BUILD_EXAMPLE "Build examples" ON)

add_subdirectory(hello)

if(BUILD_EXAMPLE)
    add_subdirectory(example)
endif()
```

构建并运行：

```sh
cmake -S . -B build
cmake --build build
./build/example/hello_world
```

输出：

```text
Hello, world!
```

这里的 C++17 是在顶层 `CMakeLists.txt` 配置的。`cmake/` helper 模块本身不强制 C++ 标准，这样同一套模块也可以服务 C++11、C++14、C++17 或更高标准的项目。

## 五、为什么它不绑定单一平台

这套写法虽然借用了 Android.mk 的变量名，但没有调用 Android NDK，也没有依赖 Android 平台。

它真正做的事只有这些标准 CMake 操作：

- `add_library`
- `add_executable`
- `target_include_directories`
- `target_link_libraries`
- `set_target_properties`

所以它可以运行在 Linux、macOS、Windows，也可以放进 Android、iOS、RISC-V、嵌入式 Linux 等项目里。区别只在于你给 CMake 选择什么 toolchain。

换句话说：

Android.mk 风格只是“前台界面”，CMake target 才是“后台实现”。

## 六、什么时候适合这样做

这种封装适合下面几类项目：

- 项目里有很多 C++ 静态库、动态库和可执行程序。
- 团队成员对 CMake 熟悉程度不一致。
- 希望每个模块的写法保持统一。
- 希望从 Android.mk 迁移到 CMake 时降低理解成本。
- 希望保留跨平台能力，而不是把构建逻辑绑死在单个平台上。

但它不适合过度包装。

如果项目只有一个 `main.cpp`，直接写原生 CMake 就很好。封装的价值来自重复场景：当你发现每个模块都在重复设置 C++ 标准、include、依赖、输出名时，再抽出这层会更划算。

## 七、一个简单判断标准

可以用一句话判断这层 helper 有没有价值：

如果一个新人打开 `CMakeLists.txt`，不懂太多 CMake，也能看出每个模块“叫什么、编哪些文件、依赖谁、生成什么”，那这层封装就是有意义的。

Android.mk 风格的优点不在于高级，而在于稳定、直观、重复成本低。

它让 CMakeLists 更像模块清单，也让跨平台 C++ 项目的构建结构更容易维护。
