+++
title = "AirPlay mDNS 双栈发现：A 和 AAAA 到底该怎么发"
date = 2026-06-08
path = "2026/06/08/airplay-mdns-ipv4-ipv6-rfc"
[taxonomies]
categories = ["Linux"]
tags = ["AirPlay", "mDNS", "DNS-SD", "IPv4", "IPv6", "RFC6762", "UxPlay", "APlay"]

+++

[TOC]

## 背景

在把 UxPlay 的 DNS-SD/Avahi 依赖替换为内置 mDNS responder 时，PR review 里出现了一个很典型的双栈问题：

> 使用内置 `mdnsd` 时，AirPlay 客户端会先建立一个 IPv4 TCP 连接，然后很快又建立一个 IPv6 TCP 连接，前一个 IPv4 连接被替换；使用 Avahi 时，只看到 IPv6 连接。

问题背景来自 UxPlay PR：

<https://github.com/FDH2/UxPlay/pull/523>

这个现象表面看像是 TCP 连接管理问题，但根因在 mDNS/DNS-SD 发现阶段：内置 responder 在每个 mDNS response 里都同时带了 `A` 和 `AAAA` 记录。客户端拿到两个可用地址后，可能先尝试 IPv4，再根据自身地址选择策略切换到 IPv6。

这篇文章整理三个问题：

1. RFC 6762/6763 对 `A` 和 `AAAA` 的真实要求是什么？
2. AirPlay 投屏场景下应该选择什么发布策略？
3. UxPlay 和 APlay 里如何把实现改到更符合规范、也更符合客户端行为？

<!-- more -->

## 不要把 RFC 6762 简化成一句话

最容易误解的一句话是：

> IPv4 mDNS response 只能发 `A`，IPv6 mDNS response 只能发 `AAAA`。

这句话不够准确。

RFC 6762 第 6.2 节的核心要求是：当 responder 在某个接口上发送自己的地址记录时，必须包含该接口上有效的地址，不能包含其它接口上无效的地址。

这句话里真正关键的是“接口”，不是“IP family”。

RFC 6762 同时还说了两件事：

- 如果 response 里放了 `A` 或 `AAAA`，在空间允许时，建议把同名的另一类地址也放进 additional section，以便客户端一次拿到完整地址集。
- 对于一个同时有 IPv4 和 IPv6 地址的物理接口，responder 可以把它当成一个双栈接口，也可以把它逻辑上拆成两个接口：一个 IPv4 逻辑接口，一个 IPv6 逻辑接口。

所以，从 RFC 角度看，存在两种合法模型。

## 模型一：一个双栈物理接口

如果实现把一个物理网卡当成一个双栈 mDNS 接口，那么在这个接口上发布的地址集可以同时包含 IPv4 和 IPv6。

这种模型下：

| 发送路径 | host address record |
| --- | --- |
| IPv4 mDNS multicast `224.0.0.251:5353` | `A` + `AAAA` |
| IPv6 mDNS multicast `ff02::fb:5353` | `A` + `AAAA` |

前提是这些地址都确实属于同一个有效接口。

这种做法符合 RFC 6762 的“fate sharing”思路：如果客户端收到其中一个地址记录，也能同时拿到另一类地址记录，减少因为 UDP 丢包导致地址集不完整的概率。

但它也有代价：客户端会更早、更明确地看到两个可连接地址。对于 AirPlay 这种 discovery 之后马上建立 RTSP/AirPlay TCP 连接的协议，客户端可能会发起两条连接，再根据自己的 Happy Eyeballs 或地址优先级策略保留其中一条。

在 PR #523 的现象里，内置 `mdnsd` 就暴露了这个问题：客户端先连 IPv4，再连 IPv6，服务端日志里出现一次连接替换。

## 模型二：IPv4/IPv6 逻辑接口拆分

RFC 6762 允许 responder 把一个双栈物理接口逻辑上拆成两个接口。这样实现时，IPv4 socket 和 IPv6 socket 各自只发布自己 family 的地址记录。

这种模型下：

| 发送路径 | host address record |
| --- | --- |
| IPv4 mDNS multicast `224.0.0.251:5353` | 只发 `A` |
| IPv6 mDNS multicast `ff02::fb:5353` | 只发 `AAAA` |

这个模型还有一个重要细节：不要在 IPv4 response 里用 NSEC 声明“没有 AAAA”，也不要在 IPv6 response 里声明“没有 A”。因为这只是逻辑接口拆分，不代表设备整体没有另一类地址。

对 AirPlay 接收端来说，我更倾向使用这个模型，原因很实际：

- 与 Avahi 在该问题上的观测行为一致。
- 可以减少客户端收到跨 family 地址后发起双连接的概率。
- 日志和问题定位更清晰：从 IPv4 mDNS 发现来的连接就应该是 IPv4，从 IPv6 mDNS 发现来的连接就应该是 IPv6。
- 对嵌入式实现更简单，不需要在一个 response 里合并和维护完整跨 family 地址集。

## RFC 6763：服务记录还要带地址

DNS-SD 使用 `PTR`、`SRV`、`TXT` 描述服务。

AirPlay 常见服务包括：

| 服务类型 | 用途 |
| --- | --- |
| `_airplay._tcp.local` | AirPlay Remote Video |
| `_raop._tcp.local` | AirTunes Remote Audio |

查询 `_airplay._tcp.local` 或 `_raop._tcp.local` 时，response 通常包含：

| 记录 | 说明 |
| --- | --- |
| `PTR` | 服务类型到服务实例名 |
| `SRV` | 服务实例到主机名和端口 |
| `TXT` | AirPlay/RAOP 能力字段 |
| `A` 或 `AAAA` | `SRV` target host 的地址 |

RFC 6763 第 12 节建议 responder 在 PTR/SRV response 的 additional records 里带上 SRV target host 的地址记录。这个规则是效率优化，不是正确性硬要求。客户端必须能在 additional records 缺失时继续查询地址。

结合前面的 logical-interface 模型，AirPlay responder 的策略可以写得更精确：

| 查询来源 | 服务记录 | host additional record |
| --- | --- | --- |
| IPv4 mDNS query | `PTR`/`SRV`/`TXT` | `A` |
| IPv6 mDNS query | `PTR`/`SRV`/`TXT` | `AAAA` |

也就是说，服务记录本身不需要按 family 分裂，但 host address record 要按发送 family 过滤。

## UxPlay 的修正

UxPlay 的内置 `mdnsd.c` 原来构建 response 时不区分发送 socket：

```c
mdns_add_a(packet, host_name, ipv4_addr, ttl);
mdns_add_aaaa(packet, host_name, ipv6_addr, ttl);
```

这样无论 response 最后通过 IPv4 socket 还是 IPv6 socket 发送，包里都会同时出现 `A` 和 `AAAA`。

修正后的核心策略是把 response family 传进 host record 构建逻辑：

```c
if (family == MDNS_FAMILY_IPV4) {
    add A;
} else {
    add AAAA;
}
```

这次还顺手修了一个计数细节：AAAA 记录是否计入 answer count，应该和实际 IPv6 地址是否非零保持一致，而不是用 `ipv6_scope_id` 间接判断。当前初始化路径里二者通常同步，但 packet builder 不应该依赖这个隐含关系。

更准确的提交描述应该是：

> 内置 mdnsd 选择 RFC 6762 允许的 IPv4/IPv6 logical-interface 模型。IPv4 response 只发布 A，IPv6 response 只发布 AAAA，避免 AirPlay 客户端因为同一个 response 同时看到双栈地址而建立两条连接。

而不是说：

> RFC 强制 IPv4 response 只能包含 A，IPv6 response 只能包含 AAAA。

后者是过度解释。

## APlay 的修正

APlay 的 mDNS responder 更偏 SDK 化，问题也更明显：原来的 public API 没有 address family 参数，`build_response()` 会生成一个同时包含 `A` 和 `AAAA` 的通用 packet，然后 live responder 把同一个 packet 发到 IPv4 和 IPv6 multicast。

这在双栈单接口模型下可以解释，但不适合我们现在选择的 AirPlay logical-interface 策略。

修正包括四部分。

第一，API 显式引入 `AddressFamily`：

```cpp
enum class AddressFamily {
    Ipv4,
    Ipv6,
};

std::vector<std::vector<std::uint8_t>> build_announcement(
    std::uint32_t ttl, AddressFamily family, std::uint32_t ipv4_address);

ResponsePlan handle_query(
    const std::uint8_t* bytes,
    std::size_t length,
    AddressFamily family,
    std::uint32_t ipv4_address);
```

这里没有保留“无 family 参数”的兼容接口。调用方必须显式选择 family，避免以后又无意识生成混合地址包。

第二，host record 构建按 family 分支：

```cpp
if (family == AddressFamily::Ipv4) {
    add A records;
} else {
    add AAAA record;
}
```

第三，直接 host 查询也按 family 过滤。IPv4 packet 里查询 `AAAA` 不应该返回 `A` 作为答案；IPv6 packet 里查询 `A` 也不应该返回 `AAAA`。`ANY` 查询则返回当前 logical interface 对应的地址记录。

第四，多 IPv4 接口 announcement 不再复用同一个 packet。APlay 的 live responder 在每个 IPv4 multicast interface 上发送时，会用该接口地址重新构建 packet，避免一个接口上的 response 带出其它接口的 IPv4 地址。

## 验证结果

UxPlay 构建验证：

```sh
cmake --build build --parallel
```

APlay 构建验证：

```sh
./scripts/linux_build.sh
cmake --build build/linux --parallel
```

APlay mDNS harness 验证：

```sh
./harness/verify_mdns.sh
build/linux/harness/mdns/aplay_harness_mdns_replay \
  resources/pcap/mdns_announce.pcapng \
  APlayHarness \
  02:00:00:00:00:01 \
  APlayHarness.local
build/linux/harness/mdns/aplay_harness_mdns_announce --once APlayHarness
```

关键输出：

```text
mDNS announcement packets=2 receiver=APlayHarness
packet[0] answers=9
packet[1] answers=9
generated IPv4 response records=9
generated IPv6 response records=9
{"mdns":"ok","capture":"resources/pcap/mdns_announce.pcapng"}
```

这里的 `9` 条记录来自：

| 类型 | 数量 |
| --- | ---: |
| `_services._dns-sd._udp.local` 到 `_airplay` / `_raop` 的 PTR | 2 |
| `_airplay` / `_raop` 到实例名的 PTR | 2 |
| AirPlay / RAOP SRV | 2 |
| AirPlay / RAOP TXT | 2 |
| family-specific host address record | 1 |

IPv4 response 是 `8 + A`，IPv6 response 是 `8 + AAAA`。这正是 logical-interface 模型下的预期。

## 最终策略

AirPlay mDNS responder 的可执行策略可以总结成下面这张表。

| 场景 | 策略 |
| --- | --- |
| 只有 IPv4 地址 | 发布 `A` |
| 只有 IPv6 地址 | 发布 `AAAA` |
| 双栈，选择单物理接口模型 | 可以在 response 中同时发布 `A` 和 `AAAA` |
| 双栈，选择 logical-interface 模型 | IPv4 response 只发 `A`，IPv6 response 只发 `AAAA` |
| AirPlay/UxPlay/APlay 当前实现 | 选择 logical-interface 模型 |
| 没有另一类地址 | 可以考虑 NSEC，但 logical-interface 模型下不要做跨 family 否定声明 |

最重要的是，不要把“是否发 A/AAAA”写成一个全局判断，而要把它绑定到 response 的发送 family 和发送接口。

## 经验

这次问题的教训不是“Avahi 一定比内置 mDNS 正确”，也不是“内置 mDNS 一定要实现完整 RFC”。

真正的经验是：

1. RFC 里经常同时存在 MUST、SHOULD 和允许的实现模型，不能只摘一句话当结论。
2. DNS-SD 的服务记录和 host 地址记录要分开思考。
3. AirPlay 客户端会对 mDNS 地址集做实际连接尝试，发现阶段的小差异会直接变成 TCP 连接行为差异。
4. 内置 responder 的优势是可控，但也意味着项目自己要把边界条件测清楚。
5. harness 很有价值。没有自动抓包和 replay，很容易只靠日志判断“能看到设备”，却漏掉 `A/AAAA` 这种协议层细节。

对 AirPlay 这类嵌入式接收端来说，logical-interface 模型是一个务实选择：足够符合 RFC，行为接近 Avahi 观测结果，也减少客户端双连接带来的状态管理噪声。
