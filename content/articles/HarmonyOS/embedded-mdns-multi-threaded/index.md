+++
title = "APlay 为什么不把 mDNS 拆成独立进程"
date = 2026-06-05
path = "2026/06/05/embedded-mdns-multi-threaded"
[taxonomies]
categories = ["HarmonyOS"]
tags = ["HarmonyOS", "RTOS", "Android", "Linux", "mDNS", "AirPlay", "架构设计", "嵌入式"]

+++

[TOC]

## 背景

在 UxPlay 的 [PR #523](https://github.com/FDH2/UxPlay/pull/523) 中，我们用内置的 mDNS responder 替换了 Avahi 依赖。PR 的 reviewer 提出了一个架构建议：是否应该把 mDNS 功能拆成独立进程，让用户自己选择用什么 mDNS 实现（Avahi、mDNSResponder 等）？

这个建议本身很合理——桌面场景下确实可以这样分工。但当目标平台变成 Android、HarmonyOS、RTOS 和裸embedded Linux 时，独立进程的代价就变得难以忽略。

这也是 APlay 架构设计里需要提前定下来的边界。APlay 不是只做一个 Linux 命令行 receiver，而是要让同一套 AirPlay 接收核心在 Linux、Android 和 HarmonyOS 之间复用：

- `app/linux` 负责 Linux CLI、配置、进程生命周期、信号处理和桌面集成。
- `app/android` 负责 Activity、Service、前台服务、权限、通知和 Android 生命周期。
- `app/harmony` 是 DevEco Studio 导入入口，构建 `APlayReceiver` HAP，并通过本地 `APlaySdk` HAR 使用 SDK。
- `sdk` 承载共享 C++ SDK、Java SDK、ETS SDK facade、JNI/NAPI binding 和打包产物。
- `protocol`、`streaming`、`crypto`、`core`、`osal` 承载可复用 native 能力，不依赖具体 app。

因此 mDNS/DNS-SD 不是某个 app 的附属脚本，也不是外部 daemon 的配置输出，而是 AirPlay receiver 协议栈的一部分：客户端先通过 `_airplay._tcp.local` 和 `_raop._tcp.local` 发现设备，随后才进入 RTSP、RAOP、AirPlay mirror、HLS、pairing/FairPlay 等连接流程。

## 多进程方案的优点

先承认这个建议有价值的一面：

1. **灵活性**：用户可以选择自己的 mDNS 实现，不被内置实现绑定
2. **职责分离**：receiver 只需要输出 TXT 记录，mDNS 广播逻辑由独立进程处理
3. **技术栈解耦**：如果系统已经有稳定可用的 mDNS daemon，没有必要自己实现
4. **升级灵活性**：mDNS 实现可以独立更新，不需要重新编译 receiver

## 多进程方案的代价

但这个架构在嵌入式场景下会带来一系列新问题：

### 1. 资源占用与功耗

多进程意味着额外的 RAM 和 CPU 开销：

- 每个进程有自己的地址空间、页表、文件描述符表、信号量
- 进程间上下文切换有 kernel overhead
- 在 ARM Cortex-M 或低端 RISC-V MCU 上，这些开销直接体现在功耗和续航上

对电池供电的嵌入式设备，这不是锦上添花，而是雪上加霜。

### 2. 进程间通信

分离进程后，receiver runtime 和 helper 之间需要 IPC 机制：

- Unix domain socket：需要设计协议、handle 连接建立和断开
- Shared memory：需要同步，成本也不低
- Pipe/FIFO：单向通信，不够灵活

无论哪种方式，都会引入额外的状态管理和错误处理代码。

### 3. 启动依赖

receiver 启动时，helper 进程必须已经在运行。解决方案：

- **systemd/init script**：嵌入式系统往往没有，或者有但配置复杂
- **supervisord**：需要额外软件包
- **动态检测 + 按需唤醒**：receiver 需要感知 helper 是否在运行，失败时重试

这些对桌面 Linux 是标配，对嵌入式/RTOS 设备却是额外负担。

### 4. 权限与平台差异

独立进程需要独立权限：

- 绑定 UDP 5353 端口需要 `CAP_NET_BIND_SERVICE`
- Android 上需要 `android.permission.INTERNET` 之外的额外权限
- HarmonyOS 的权限模型与 Android 不同，需要分别处理
- RTOS 上可能根本没有权限模型的概念

### 5. 安全攻击面

每增加一个独立进程，就增加一个攻击面：

- IPC 通道可能被 exploit
- Helper 进程的特权如果被攻破，影响范围更大
- 嵌入式设备的安全更新频率通常低于桌面系统

### 6. 状态同步

如果 helper 进程崩溃或被 kill：

- receiver 不知道自己失去了 mDNS 广播能力
- 需要检测 helper 存活状态并重新启动
- 对 headless 嵌入式设备，调试困难

### 7. 部署复杂度

用户需要同时维护：

- receiver 二进制
- mDNS helper 二进制或脚本
- 启动脚本或 systemd unit
- 两个进程的版本兼容性

对嵌入式交付来说，这增加了集成和测试的工作量。

### 8. RTOS 和 HarmonyOS 的特殊约束

对于 RTOS 和新型物联网平台：

- 标准 POSIX 进程模型可能不被支持，或者支持不完整
- HarmonyOS 的 native 服务模型与 Linux 守护进程不同，需要平台特定的实现方式
- 独立 mDNS daemon 在这些平台上根本不存在，引入它反而增加了移植负担

## APlay 的当前方案：单进程多线程

内置 mDNS responder 用单进程 + 内部线程的方案：

```
APlayReceiver / APlaySdk 所在进程
├── app 主线程：平台 UI、配置和生命周期
├── protocol IO 线程：TCP accept、request parse、response write
├── mDNS 线程：UDP 5353 announce、query parse、response write
├── RTP / mirror / timing 线程：音频、镜像视频和时间同步
└── render / codec 线程：由 OSAL 平台实现管理
```

这里的重点不是“只允许一个线程”，而是“不额外拆一个系统进程”。APlay 首版线程模型本来就会按协议职责拆分：mDNS 负责发现，protocol IO 负责 RTSP/HTTP，RTP/mirror/timing 负责流媒体数据，render/codec 由平台 OSAL 管理。它们共享同一个 SDK runtime，通过 typed callback 或 queue 传递跨线程事件，避免模块直接访问对方内部状态。

这个架构的优势：

| 维度 | 多进程方案 | 单进程多线程 |
| --- | --- | --- |
| 资源占用 | 每个进程独立 RAM | 共享地址空间 |
| 启动依赖 | 需要额外进程管理 | 随主进程启动 |
| 部署 | 两个二进制 + 启动脚本 | 一个 app / SDK runtime |
| 状态同步 | 需要进程间通信 | 线程间 mutex 即可 |
| 权限 | Helper 需要独立权限 | 主进程权限足够 |
| 平台适配 | 需要各平台调整 | 代码内条件编译 |
| HarmonyOS | 需要额外 native service 设计 | HAP + HAR + NAPI 内聚 |
| 嵌入式 | 负担重 | 自然适配 |

## 放到 APlay 架构里看

APlay 的 mDNS responder 位于 `sdk/src/main/cpp/protocol/mdns`，对外导出 `mdns.hpp`。它不是一个通用 DNS-SD 框架，而是 AirPlay receiver 发现阶段需要的最小 responder：

- `_services._dns-sd._udp.local` 服务枚举。
- `_airplay._tcp.local` 和 `_raop._tcp.local` PTR 查询。
- AirPlay/RAOP 实例的 `SRV`、`TXT` 能力记录。
- host `A` 记录。
- `TTL=0` 的 goodbye response。

AirPlay 和 RAOP 的 TXT 能力描述不放在 app 里，也不交给外部 helper 拼字符串，而是由 `streaming/airplay` 和 `streaming/raop` 提供 service profile helper。这样 `protocol/mdns` 只理解 DNS-SD 记录结构，`streaming` 模块保留 AirPlay/RAOP 的业务含义，`app/linux`、`app/android`、`app/harmony` 只负责启动和停止 SDK。

这条边界对 HarmonyOS 尤其重要。Harmony 侧的入口是 `app/harmony` HAP，它依赖 `sdk` 下的本地 `APlaySdk` HAR；ETS facade 通过 NAPI 调用 `libaplay_napi.so`，C++ SDK object target 链入 NAPI library，打包时只暴露 Harmony 需要加载的 native module。也就是说，Harmony 应用看到的是一个可导入、可打包、可由生命周期控制的 SDK，而不是一组必须额外安装和拉起的 Linux 风格守护进程。

如果为了 mDNS 再引入独立进程，Harmony 侧会额外出现这些问题：

- HAP 如何声明、安装和启动这个 native helper。
- helper 如何跟 Ability / ServiceExtension / SDK runtime 同步生命周期。
- helper 崩溃时 app 如何感知并恢复发现能力。
- helper 与 SDK 间 IPC 协议如何版本兼容。
- HAR 作为 SDK 分发时如何交付和约束这个进程。

这些问题都不是 AirPlay 协议本身要解决的问题。对 APlay 来说，更合理的做法是让 mDNS 成为 SDK runtime 内部的协议能力，由平台 app 把生命周期事件传给 SDK。

对 ARM Linux、Android、HarmonyOS 和 RTOS 来说，内嵌 mDNS responder 是更务实的选择：

- **零外部依赖**：不要求系统有 Avahi、Bonjour 或任何 mDNS daemon
- **单进程生命周期**：mDNS responder 的生命周期与 receiver runtime 完全绑定，一起启动一起退出
- **最小占用**：只有一个 socket、少量内存和一个后台线程
- **平台一致**：同一份代码在所有目标平台上行为一致

## 结论

架构选择没有绝对的好坏，只有场景是否匹配：

- **桌面/服务器场景**：多进程 + systemd + 独立 mDNS 服务是更灵活的方案
- **嵌入式/移动端场景**：单进程多线程是更务实的方案

这也是为什么 [APlay](https://github.com/kgbook/APlay) 采用嵌入式 mDNS 架构：目标平台覆盖 ARM/RISC-V 设备、Android、ARM Linux、HarmonyOS 和未来 RTOS，独立进程带来的生命周期、权限、IPC 和分发复杂度远远大于它带来的灵活性。

把复杂留给通用系统，把简单留给嵌入式场景，这是嵌入式软件架构的基本常识。
