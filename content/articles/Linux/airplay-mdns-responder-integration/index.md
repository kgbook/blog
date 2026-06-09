+++
title = "AirPlay mDNS Responder 集成：从占位到生产级广播"
date = 2026-06-09
path = "2026/06/09/airplay-mdns-responder-integration"
[taxonomies]
categories = ["Linux"]
tags = ["AirPlay", "mDNS", "APlay", "goodbye", "packet capture"]

+++

[TOC]

## 背景

APlay 的 Linux 接收端 `APlayReceiver` 之前只是一个占位程序——`main()` 里打印几行日志就退出了。SDK 里的 mDNS responder 已经实现了 AirPlay 和 RAOP 服务的完整广播逻辑，但从未被 Linux app 调用过。

这篇文章记录了把 mDNS responder 集成到 Linux app 的全过程，以及在这个过程中通过抓包发现的三个问题：

1. 周期性广播逻辑应该放在哪里
2. 进程退出后设备仍然可被发现（没有发送 goodbye）
3. iOS 把设备识别为音频设备而不是 TV

<!-- more -->

## 第一步：集成 mDNS Responder

### 初始实现

最直接的思路：在 `runtime.cpp` 里配置 AirPlay/RAOP 服务，启动 responder，然后主线程循环调用 `announce()` 发送广播。

```cpp
// 配置服务
ResponderConfig config;
config.host_name = "APlayReceiver.local";
// ... 设置 AirPlay 和 RAOP profile ...

// 启动 responder
MdnsResponder& responder = MdnsResponder::instance();
responder.set_config(config);
responder.start();

// 主线程循环广播
while (!g_should_stop) {
    responder.announce();
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
}
```

这段代码能工作，但有个设计问题：**为什么需要主线程来做周期性广播？**

### 分析 responder 线程

看 `MdnsResponder` 的实现，`start()` 会启动一个后台线程运行 `EventLoop`，但这个线程只处理收到的 mDNS 查询（通过 `handle_ipv4_readable` / `handle_ipv6_readable`），并不会主动发送 announce。

这意味着周期性广播的职责被推给了调用方。对于一个独立运行的 responder 来说，这不合理——广播应该是 responder 自己的事。

### 解决方案：把 announce 内聚到 responder 线程

给 `start()` 加一个 `announce_interval_ms` 参数，在 `run_once()` 里检查时间，到期就自动发送 announce：

```cpp
int start(int announce_interval_ms = 1000);
```

```cpp
bool run_once() {
    if (announce_interval_ms_ > 0) {
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - last_announce_time_).count();
        if (last_announce_time_ == time_point::min() ||
            elapsed >= announce_interval_ms_) {
            announce(kServiceTtl);
            last_announce_time_ = now;
        }
    }
    return loop_.run_once(250);
}
```

主线程现在只需要 `pause()` 等信号：

```cpp
responder.start();  // 内部自动广播
while (!g_should_stop) {
    ::pause();
}
responder.stop();
```

## 第二个问题：退出后设备仍然存在

集成完成后的第一次测试发现：杀掉 APlayReceiver 进程后，iPhone 上仍然能看到这个设备，要等很久才消失。

### 抓包分析

在 macOS 上用 tcpdump 抓 en0 的 5353 端口：

```bash
tcpdump -i en0 port 5353 -c 30 -w /tmp/mdns.pcap
```

启动 APlayReceiver，等几秒，kill，然后分析抓包。

**正常广播（进程运行期间）**：每秒一个包，包含完整的 9 条记录——PTR、SRV、TXT（AirPlay + RAOP 各 4 条）加上 A 记录，TTL=4500。这是对的。

**退出时**：抓到了 goodbye 包——同样 9 条记录，但 TTL=0。这看起来是正确的。

### 但设备还是没消失

再仔细看，退出后还有几个包在发：

| 包号 | 时间 | 答案数 | TTL | 内容 |
|------|------|--------|-----|------|
| 16 | 4.427s | 9 | 0 | goodbye（正确） |
| 18 | 4.428s | 2 | 4500 | 只有 meta-query PTR |
| 21 | 4.604s | 2 | 4500 | 只有 meta-query PTR |

包 18 和 21 在 goodbye 之后到达，TTL=4500，虽然只有 2 条 meta-query PTR（不是完整的服务记录），但可能干扰了客户端的缓存清除。

### 根因：Singleton 析构导致 stop() 被调用两次

`MdnsResponder` 是一个 Singleton。`runtime.cpp` 显式调用了 `responder.stop()`，然后 `main()` 返回时 Singleton 析构又调了一次 `~Impl()` → `stop()`。

第二次 `stop()` 时 socket 已经关闭，但 `announce(0)` 仍然会构建包并尝试发送。虽然 `send_to()` 会失败，但时序上的微妙差异导致了异常包的产生。

### 解决方案：加 stopped 守卫

```cpp
void stop() {
    if (stopped_) {
        return;
    }
    stopped_ = true;

    loop_.stop();
    thread_.stopAndJoin();

    announce(0);  // goodbye: TTL=0

    // 关闭 socket...
}
```

修复后抓包验证：goodbye 包正常发出，之后不再有异常包。设备在 iPhone 上立即消失。

## 第三个问题：iOS 显示为音频设备

功能验证通过后，发现一个体验问题：iOS AirPlay 投屏列表里，APlayReceiver 显示为音频设备图标，而不是 TV 图标。

### 对比真实设备的 TXT 记录

抓了一份 UxPlay（运行在 iMac 上，iOS 识别为 TV 设备）的 mDNS 广播，逐字段对比：

| 字段 | APlayReceiver | UxPlay@iMac |
|------|--------------|-------------|
| **features** | `0x527FFEE6,0x0` | `0x527FFEE6,0x0` |
| **model** | `APlayReceiver` | **`AppleTV3,2`** |
| flags | `0x4` | `0x4` |
| srcvers | `220.68` | `220.68` |
| vv | `2` | `2` |
| deviceid | `02:00:00:00:00:01` | `b2:46:ee:39:57:64` |

**features 完全一致**——位域值相同，视频能力位都已设置。

差异在 `model` 字段。iOS 根据 `model` 的值判断设备类别：`AppleTV` 前缀的型号被识别为 TV 类设备，其他值降级为音频设备。

### 解决方案

把 `AirPlayServiceProfile` 的默认 `model` 改为 `AppleTV6,2`（Apple TV 4K）：

```cpp
struct AirPlayServiceProfile {
    // ...
    std::string model = "AppleTV6,2";
    // ...
};
```

修复后抓包确认 AirPlay TXT 记录包含 `model=AppleTV6,2`，iOS 设备列表中正确显示为 TV 图标。

## 附带改进：format_ipv4 提升为共用函数

实现过程中，`runtime.cpp` 里写了一个把 `uint32_t` 格式化为点分十进制的辅助函数。这个功能在 SDK 其他地方也有需求，提升到了 `core/network/interface` 模块：

```cpp
// network_interface.hpp
std::string format_ipv4_address(std::uint32_t address);

// network_interface.cpp
std::string format_ipv4_address(std::uint32_t address) {
    ::in_addr addr{};
    addr.s_addr = htonl(address);
    char buf[INET_ADDRSTRLEN] = {};
    ::inet_ntop(AF_INET, &addr, buf, sizeof(buf));
    return buf;
}
```

与已有的 `parse_ipv4_address`（字符串 → uint32_t）互为逆操作。

## 总结

这次集成改动不大，但通过抓包发现了三个不明显的 bug：

1. **架构问题**：周期性广播不应由调用方管理，内聚到 responder 线程后主线程只需 `pause()`
2. **生命周期问题**：Singleton 析构导致 `stop()` 重复调用，需要 `stopped_` 守卫
3. **协议语义问题**：`model` 字段影响 iOS 的设备分类，需要通过抓包对比真实设备才能发现

三个问题的共同特点是：**代码逻辑看起来都对，但运行时行为不对**。只有通过抓包对比实际网络上的报文，才能定位到真正的问题。
