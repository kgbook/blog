+++
title = "AirPlay 投屏设备发现稳定性：mDNS 缓存一致性问题定位与修复"
date = 2026-06-19
path = "2026/06/19/airplay-mdns-cache-coherency"
[taxonomies]
categories = ["Linux"]
tags = ["AirPlay", "mDNS", "DNS-SD", "RFC6762", "Avahi", "APlay", "Wireshark"]

+++

## 背景

APlayReceiver 是 APlay 项目里的 Linux AirPlay/RAOP 接收端。Apple 设备发现 AirPlay 接收端依赖 Bonjour，也就是 mDNS + DNS-SD。

这次问题的现象是：

- 昨天 Apple 设备可以发现 `APlayReceiver`。
- 晚上设备自动休眠，没有关机，第二天 Apple 设备的投屏设备列表找不到 `APlayReceiver`。
- 重启 Apple 设备后，又可以发现 `APlayReceiver`。

这个现象很关键。它不像单个 TXT 字段缺失，也不像服务完全没有发包。Apple 设备重启后恢复，说明 Apple 端的 mDNSResponder 缓存、网络接口状态、browse session 或 stale SRV/A/AAAA 记录被重置了。

所以定位重点不是“如何让 APlay 远程命令 Apple 清缓存”，而是：APlay 的 mDNS responder 是否按 RFC6762 提供了足够标准的缓存一致性信号，让 Apple 设备在长时间休眠、唤醒、网络状态变化后仍能稳定发现服务。

<!-- more -->

## AirPlay 发现依赖什么

AirPlay 设备发现不是扫描局域网 IP，而是 DNS-SD browse。

常见服务包括：

| 服务 | 作用 |
| --- | --- |
| `_airplay._tcp.local` | AirPlay 视频、镜像和控制入口 |
| `_raop._tcp.local` | RAOP/AirTunes 音频入口 |

DNS-SD 的记录关系是：

| 记录 | 作用 |
| --- | --- |
| `PTR` | 服务类型到服务实例名 |
| `SRV` | 服务实例到 host + port |
| `TXT` | 能力字段 |
| `A` / `AAAA` | SRV target host 的地址 |

Apple 端缓存的不只是“有这个设备”，还包括服务实例名、SRV 端口、host name、IPv4/IPv6 地址、TXT 能力字段。只要这些记录中的旧值没有及时失效，就可能出现列表不稳定、连接旧端口，甚至短时间内完全不显示设备。

## APlay 不能直接刷新 Apple 端缓存

mDNS/DNS-SD 没有“让对端刷新 discovery cache”的控制命令。APlay 不能直接重启 Apple 端 mDNSResponder，也不能直接重置 Apple 设备的网络接口状态。

Sleep Proxy 也不是 AirPlay receiver 用来刷新 Apple 发现缓存的机制。除非服务端真实实现 Sleep Proxy，否则不应该伪装或发布相关服务。

APlay 能做的是遵守 RFC6762 的缓存一致性机制：

- 启动、唤醒、链路变化后先 probe，再 announce。
- 对唯一记录使用 cache-flush。
- 正常退出或旧记录失效时发送 TTL=0 goodbye。
- 正确回答 Apple 唤醒或接口激活后发出的 QU query。
- 避免发布 Apple 设备不可达的地址。
- 避免用过高频率的周期 announce 代替正确的状态机。

## RFC6762 的关键约束

### 启动和网络变化必须 probe + announce

RFC6762 第 8 节要求：

> Whenever a Multicast DNS responder starts up, wakes up from sleep,
   receives an indication of a network interface "Link Change" event, or
   has any other reason to believe that its network connectivity may
   have changed in some relevant way, it MUST perform the two startup
   steps below: Probing (Section 8.1) and Announcing (Section 8.3).

Multicast DNS responder 启动、从睡眠唤醒、收到链路变化事件，或认为网络连通性发生相关变化时，必须执行 Probing 和 Announcing 两步。

>   The first startup step is that, for all those resource records that a
   Multicast DNS responder desires to be unique on the local link, it
   MUST send a Multicast DNS query asking for those resource records, to
   see if any of them are already in use. 

Probe 的目标是确认本机即将发布的唯一记录没有冲突。

> 250 ms after the first query, the host should send a second; then,
   250 ms after that, a third.  If, by 250 ms after the third probe, no
   conflicting Multicast DNS responses have been received, the host may
   move to the next step, announcing. 
   
典型流程是发 3 轮 `ANY` probe，间隔约 250ms；确认没有冲突后再进入 announce。

### 不能长期定期 announce

RFC6762 第 8.3 节要求：

> The Multicast DNS responder MUST send at least two unsolicited
   responses, one second apart.  To provide increased robustness against
   packet loss, a responder MAY send up to eight unsolicited responses,
   provided that the interval between unsolicited responses increases by
   at least a factor of two with every response sent.

unsolicited response 至少发送两次、间隔一秒；可以最多八次，但间隔要逐步增大。

> A Multicast DNS responder MUST NOT send announcements in the absence
   of information that its network connectivity may have changed in some
   relevant way.  In particular, a Multicast DNS responder MUST NOT send
   regular periodic announcements as a matter of course.

更重要的是，RFC 明确禁止 responder 在没有网络变化信息的情况下例行周期公告。也就是说，长期每秒 announce 不是“更稳”，而是偏离 RFC 状态机。

正确做法是：启动时公告、记录变化时公告、接口变化时公告、响应查询时回复。

### QU unicast response 也要 TTL 255

Apple 设备在唤醒或接口激活时，可能发送 QU question。QU 的含义是：查询方愿意接受 unicast response。

RFC6762 第 11 节要求：

> All Multicast DNS responses (including responses sent via unicast)
   SHOULD be sent with IP TTL set to 255.  This is recommended to
   provide backwards-compatibility with older Multicast DNS queriers
   (implementing a draft version of this document, posted in February 2004) 
   that check the IP TTL on reception to determine whether the
   packet originated on the local link.  These older queriers discard
   all packets with TTLs other than 255.

所有 mDNS response，包括 unicast response，IP TTL/hop-limit 应设置为 255。这样接收方可以确认响应来自本地链路。

如果 multicast response 是 TTL 255，但 unicast response 走系统默认 TTL，例如 64，那么就会在 Apple 唤醒 discovery 路径上留下兼容性风险。

### Known-Answer Suppression

RFC6762 第 7.1 节要求：

>  A Multicast DNS responder **MUST NOT** answer a Multicast DNS query if
   the answer it would give is already included in the Answer Section
   with an RR TTL at least half the correct value.  If the RR TTL of the
   answer as given in the Answer Section is less than half of the true
   RR TTL as known by the Multicast DNS responder, the responder **MUST**
   send an answer so as to update the querier's cache before the record
   becomes in danger of expiration.

如果 query 的 Answer Section 已经包含 responder 准备回答的记录，并且 TTL 不低于真实 TTL 的一半，responder 不应重复回答。

Apple 设备的 browse query 经常会带 Known-Answer 列表。忽略 Known-Answer 会导致重复响应、网络噪声增加，也会让长期运行后的 discovery 行为更难预测。

## Avahi daemon 的对照行为

用 Avahi daemon 作为 Linux mDNS 参考实现，可以看到它的行为更接近 RFC6762 状态机：

1. 启动时先发送 probe query，探测服务实例和主机名是否冲突。
2. probe 通过后再发送有限次数的 announce。
3. announce 不是无限每秒发送。
4. 正常退出时发送 TTL=0 goodbye。
5. 接口变化、名称冲突、known-answer、duplicate suppression 等由 daemon 统一处理。

这说明稳定发现不是靠“不断刷公告”，而是靠完整的 mDNS 状态机。

## APlay 当前暴露的问题

结合 RFC 和 Avahi 对照，APlay 当前 mDNS responder 暴露出几个确定问题。

### 缺少 startup probe

APlay 启动后直接 announce，没有先对 host name、AirPlay service instance、RAOP service instance 做唯一性 probe。

这不符合 RFC6762 对启动和链路变化的要求。长时间运行后，如果网络中出现同名记录、旧缓存或接口状态变化，APlay 没有走标准的冲突检测和重新声明流程。

### 长期每秒 announce

APlay 当前默认会持续约每秒发送 unsolicited announcement。这个行为与 RFC6762 “不得例行周期公告”的要求相冲突，也和 Avahi daemon 的有限 announce 行为不同。

高频 announce 不能可靠刷新 Apple 缓存。相反，它可能让 Apple 端 browse session 和 known-answer 机制持续处在高噪声状态。

### unicast response TTL 不正确

APlay multicast mDNS response 的 TTL/hop-limit 是 255，但 unicast response 使用了系统默认 TTL。对于 Apple 唤醒后可能发送的 QU query，这是一条明确的 RFC 兼容性风险。

### 缺少 Known-Answer Suppression

APlay 会忽略 query 中已有的 Known-Answer，仍然返回完整记录。这个问题不一定单独导致设备消失，但它不符合 RFC6762 规范，并会放大长期运行后的 discovery 噪声。

### 随机 SRV 端口放大 stale cache

APlayReceiver 的 HTTP 服务端口由系统随机分配，mDNS SRV 记录再发布这个端口。如果服务重启、进程异常、网络变化或旧 goodbye 没有被 Apple 收到，Apple 端可能短时间保留旧 SRV 端口。

Apple 设备重启后恢复发现，很符合 stale SRV/cache 被清掉后的表现。

### 设备身份和接口选择不够稳定

AirPlay 文档里 `deviceid` 通常是设备 MAC。APlay 使用固定的虚拟 device id，会让多设备、多次运行或旧缓存场景更容易混淆。

同时，Linux 主机可能有 Docker bridge、虚拟网卡等接口。若 responder 发布了 Apple 不可达的地址，也会污染 Apple 端缓存。

## 为什么 Apple 重启后恢复

Apple 设备重启会让 mDNSResponder cache、网络接口状态和 AirPlay browse session 重新初始化。旧的 PTR/SRV/TXT/A/AAAA 记录被清空或重新评估，因此设备重新出现。

这不是 Apple 重启“修好了 APlay”，而是重启绕过了 APlay 没有完整 mDNS 缓存一致性状态机的问题。

要让设备隔夜、长时间休眠、网络状态变化后仍稳定发现，APlay 需要按 RFC 提供正确的刷新信号，而不是依赖 Apple 端重启。

## 解决思路

修复应按优先级推进。

### 第一阶段：修复明确 RFC 问题

1. unicast mDNS response 设置 IP TTL/hop-limit 为 255。
2. 去掉长期每秒 announce，只保留启动和状态变化时的 announce。
3. 增加 startup probe，announce 前发送 3 轮 `ANY` probe。
4. 实现 Known-Answer Suppression，至少对 shared PTR 记录做抑制。

这四项能直接对齐 RFC6762，也覆盖 Apple 唤醒后 discovery 的关键路径。

### 第二阶段：补齐长期稳定性

1. 监听 Linux netlink 网络接口变化。
2. 网络变化时对旧记录发送 goodbye，对新接口重新 probe + announce。
3. 默认过滤 Docker、bridge、虚拟网卡，只发布真实 LAN/Wi-Fi 接口。
4. 从主 LAN 网卡 MAC 派生稳定 device id。
5. 固定 receiver 端口，或确保端口变化前旧 SRV 一定 TTL=0 goodbye。

## 验证手段

验证不能只看“Apple 列表出现了”，还要验证协议行为。

### 构建验证

```sh
./scripts/linux_build.sh
```

### 抓包验证

抓取 mDNS 流量后检查：

| 验收项 | 预期 |
| --- | --- |
| startup probe | announce 前出现 3 轮 `ANY` probe |
| announce 节奏 | 不再无限每秒 announce |
| unicast TTL | IPv4 TTL 和 IPv6 hop-limit 都是 255 |
| goodbye | 正常停止时 TTL=0 |
| Known-Answer | TTL 足够高时不重复回答 shared PTR |
| 接口地址 | 不发布 Apple 不可达的虚拟接口地址 |

### 长时间验证

最终需要做隔夜验证：

1. 启动 APlayReceiver，Apple 设备确认可以发现。
2. Apple 设备长时间待机或休眠， 第二天唤醒 Apple 设备; 确认 AirPlay 列表仍能稳定发现 `APlayReceiver`。
3. 抓包确认 Apple 唤醒查询能得到符合 RFC 的响应。

## 总结

这类问题容易被误判为 AirPlay feature bit、TXT 字段或 Apple 端异常。但“隔夜后不可发现，重启 Apple 后恢复”更像 mDNS cache coherency 问题。

APlay 要稳定被发现，核心不是发更多包，而是按 RFC6762 和 Avahi daemon 的成熟行为补齐状态机：probe、有限 announce、TTL=0 goodbye、QU unicast TTL 255、Known-Answer Suppression，以及网络接口变化后的重新发布。

这套修正完成后，Apple 设备长时间休眠再唤醒时，才有足够可靠的协议信号刷新或重建 discovery 状态。
