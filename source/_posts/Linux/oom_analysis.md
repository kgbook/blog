---
layout: post
title: OOM 问题分析
date: 2018-05-23
categories:
- Linux
tags: 
- Linux
---

最近在开发一款流媒体后视镜产品，发现触摸设备不响应触控事件，画面冻住不动，串口日志提示Out of memory。而 release 版本看门狗程序未被注释（进入了编译分支），APP 进程因为 OOM 被 kill ，无法及时喂狗，导致系统不断重启 。

OOM 的主要场景：

1. 开机 OOM。

2. 视频回放时 OOM。

主要现象：

Linux App 进程被 kill，无法喂狗，系统重启。

>Out of memory: Kill process 83 (DCam) score 747 or sacrifice child
Killed process 83 (DCam) total-vm:815212kB, anon-rss:108000kB, file-rss:264kB

海思平台的芯片 DDR 内存主要划分为 MMZ 内存和 OS 内存两部分来管理，MMZ 内存主要用于VI，VPSS 和 VENC 等，OS 内存一般用于linux操作系统即 malloc 分配。

## 内存不足

针对问题（1），Linux 上电后各项业务尚未完全跑起来就被 Kill 了，主要媒体以及UI模块耗内存较多，属于典型的内存不足。调整内存布局，从 LiteOS MMZ 划分出 50MB 给到 Linux MMZ，该问题得到解决。

## 内存泄漏
问题（2），由 memory leak 引起。

后台监控进程占用内存信息：
```
while :
do
    cat /proc/$(pidof DCam)/status
    cat /proc/media-mem | grep used
    sleep 1
done
```
Proc信息显示DCam进程回放前占用物理内存48244 kB

![beforePlayback](images/before-playback-VmRSS.png "before-playback-VmRSS.png")

视频回放，多次切换视频文件，DCam进程占用物理内存124844kB！

![afterPlayback](images/after-playback-VmRSS.png "after-playback-VmRSS.png")

即DCam 进程占用内存不断增长。

需要特别注意的，ffmpeg 解封装 lib 库更新前只解码大码流那路 video track，更新为强制解码小码流的 video track，才频繁出现的回放 OOM 问题。

交叉编译 Valgrind 内存检测工具进一步检测，反馈给海思，FAE 给到的解决方案：
> 多track场景下，依次读取多track数据时，对不关注的track数据分支未进行有效释放处理, 需要调用 `av_packet_unref(&avpkt);` 释放内存。

修改后验证，暂未发现内存泄漏。
