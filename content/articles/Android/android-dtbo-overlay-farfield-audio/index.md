+++
title = "Android DTBO Overlay：远场语音多麦克风多功放动态配置实践"
date = 2026-06-17

[taxonomies]
categories = ["Android"]
tags = ["Android", "DTS", "DTBO", "Device Tree", "Amlogic", "远场语音", "音频配置", "Overlay"]
+++

在 Android TV 项目中，同一套系统源码经常要适配多个硬件 BOM。屏、背光、按键、音频通道、麦克风和功放数量等都可能不同。本文以Amlogic T966D5 项目里的远场语音麦克风配置为例，讲清楚如何用 DTBO overlay 在不改基础 DTS 的情况下，生成两套可烧录的设备树 overlay 镜像：

- `4mic_3amp_10ch_dtbo.img`：四麦、三功放、10 通道配置
- `2mic_2amp_6ch_dtbo.img`：双麦、双功放、6 通道配置

文章尽量从零解释 DTS、DTB、DTBO、overlay 是什么，再落到实际文件、脚本、验证方法。即使之前没有接触过设备树，也可以顺着看懂。

<!-- more -->

## 先搞懂几个概念

### DTS 是什么

DTS，全称 Device Tree Source，是设备树源码。它描述硬件长什么样，例如：

- CPU 有哪些外设
- I2C、SPI、GPIO 地址是什么
- 声卡、麦克风、功放、屏幕等硬件如何连接
- 某个驱动需要读取哪些配置参数

DTS 是给内核看的。驱动启动时会从设备树里读配置，比如音频驱动读取麦克风通道数、通道 mask、lane mask 等。

### DTB 是什么

DTB，全称 Device Tree Blob，是 DTS 编译后的二进制格式。源码里的 `.dts` / `.dtsi` 不能直接给 bootloader 或 kernel 使用，需要用 `dtc` 编译成 `.dtb` 或 `.dtbo`。

可以简单理解为：

```text
.dts  人能读的源码
.dtb  机器能读的二进制
```

### DTBO 是什么

DTBO，全称 Device Tree Blob Overlay，是“设备树补丁”。它不是完整描述一块板子的设备树，而是对已有设备树做局部覆盖。

比如基础 DTS 里默认是 2mic：

```dts
datain_chnum = <2>;
datain_chmask = <0x3>;
datain-lane-mask-in = <1 0 0 0>;
```

如果某个 BOM 需要 4mic，就可以用 overlay 改成：

```dts
datain_chnum = <4>;
datain_chmask = <0xf>;
datain-lane-mask-in = <1 1 0 0>;
```

这样基础 DTS 不需要为了每个 BOM 拆很多份，只在需要时叠加 overlay。

### dtbo.img 是什么

Android 最终烧录的通常不是单个 `.dtbo` 文件，而是一个 `dtbo.img` 容器。它由 `mkdtimg` 生成，里面可以放一个或多个 `.dtbo` entry。

本项目里为了 onebin 按机型动态烧录，最终需要两个单独镜像：

```text
4mic_3amp_10ch_dtbo.img
2mic_2amp_6ch_dtbo.img
```

onebin 根据 `model.ini` 里的 `FARFIELD_AUDIO` 字段选择烧录哪一个。

## 要解决的问题

远场语音相关基础 DTS 文件是：

```text
common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/customer/mesont6x_audio.dtsi
```

里面的 `loopbacka` 节点包含远场录音相关配置，不同硬件需要不同参数。

2mic+2amp/6ch 配置：

```dts
datain_chnum = <2>;
datain_chmask = <0x3>;
datain-lane-mask-in = <1 0 0 0>;
datalb_chnum = <4>;
datalb_chmask = <0xf>;
datalb-lane-mask-in = <1 1 0 0>;
```

4mic+3amp/10ch 配置：

```dts
datain_chnum = <4>;
datain_chmask = <0xf>;
datain-lane-mask-in = <1 1 0 0>;
datalb_chnum = <6>;
datalb_chmask = <0x3f>;
datalb-lane-mask-in = <1 1 1 0>;
```

## 陷阱 1：烧录dtbo镜像后 audio overlay 不生效

早期做法是在 `mesont6x_audio.dtsi` 里用注释保留两套配置，人为切换编译成多个 dtbo.img，然后在 recovery 烧录进 dtbo 分区。

一个很容易误判的问题：

板端`dtbo.img` 和 `4mic_3amp_10ch_dtbo.img` 的 md5 一样，recovery 也确实把镜像写到了 `/dev/block/by-name/dtbo`，但动态切换后 tinycap 录出来还是只有 2 路麦克风数据，而不是 4.

这个现象最迷惑人的地方在于：镜像 md5 一样，看上去“文件已经对了”。

```bash
$adb shell md5sum /dev/block/by-name/dtbo
6dfcf07c0bd42c1a0da13a3b7ec51db6  /dev/block/by-name/dtbo
```

但 Android 启动链路里，“分区文件一样”不等于“kernel 运行时看到的设备树一样”。

### 第一步：先把问题拆层

排查时先不要急着改 DTS，而是把链路拆成几层：

```text
dtbo.img 文件内容
  |
  v
dtbo 分区是否写对
  |
  v
bootloader 是否真的加载这个 dtbo 分区
  |
  v
kernel 最终 running device tree 是否被 overlay 修改
  |
  v
ALSA / mixer / tinycap 是否按 10ch 打开
```

md5 只能证明第一层或第二层，不能证明后面几层。

所以当时的判断是：不要只看 `/dev/block/by-name/dtbo`，还要看运行时设备树，也就是 kernel 真正生效后的结果。

### 第二步：比较运行时 DTS

正确的检查方式是分别在两种环境里导出 running DTS：

1. 非动态切换、确认 10ch 正常的环境。
2. recovery 动态切换后、实际只有 2 路mic数据的环境。

常用命令类似：

```sh
$ adb exec-out cat /sys/firmware/fdt > running.dtb
$ dtc -I dtb -O dts -o running.dts running.dtb
```

然后搜索音频节点：

```sh
$ rg -n "loopback@0|datain_chnum|datain_chmask|datalb_chnum|datalb_chmask" running.dts
3755:			loopback@0 {
3761:				datain_chnum = <0x02>;
3762:				datain_chmask = <0x03>;
3766:				datalb_chnum = <0x04>;
3767:				datalb_chmask = <0x0f>;
3785:				datain_chnum = <0x04>;
3786:				datain_chmask = <0x0f>;
3789:				datalb_chnum = <0x02>;
3790:				datalb_chmask = <0x03>;
```

对比后发现，运行时 DTS 确实不一样。正常 4mic 环境里能看到类似 `datain_chnum = <0x04>;`的配置，而动态切换后仍然是 2mic/6ch 配置。

这一步很关键，它说明 kernel 最终看到的设备树确实没有变成 10ch。

### 第三步：确认 dtbo.img 里面到底有什么

接下来要回答一个问题：我们动态烧录的 `4mic_3amp_10ch_dtbo.img` 里，真的有 4mic/10ch audio overlay 吗？

先看 dtbo 容器：

```sh
prebuilts/misc/linux-x86/libufdt/mkdtimg dump 4mic_3amp_10ch_dtbo.img
```

当时确认到的结论是：这个 dtbo 镜像只有一个 entry，并不是多 entry 镜像。因此问题不是 bootloader 在多个 entry 里选错了。

然后继续把 entry 反编译出来看内容：

```sh
prebuilts/misc/linux-x86/dtc/dtc -I dtb -O dts 4mic_3amp_10ch_dtbo.img
```

真正的发现点在这里：旧的 dtbo 里只有类似下面两类 overlay：

```dts
dummy-battery {
    compatible = "amlogic, dummy-battery";
    status = "okay";
};

dummy-charger {
    compatible = "amlogic, dummy-charger";
    status = "okay";
};
```

也就是说，旧的 `dtbo.img` 只是 Android overlay，主要补 dummy battery / dummy charger，里面根本没有：

```dts
datain_chnum
datain_chmask
datain-lane-mask-in
```

这就解释了为什么“md5 一样但动态切换后不是 10ch”：因为这个 dtbo 本来就没有承载音频通道差异。

### 反推真正的配置来源

既然旧 dtbo 没有 audio overlay，那么非动态切换版本里的 10ch 配置从哪里来？

结合源码和运行时 DTS，可以反推出：原来的 10ch 更可能来自基础 DTB，也就是编译进 vendor boot / boot 相关镜像里的 base device tree，而不是来自 `/dev/block/by-name/dtbo` 分区 overlay。

先确认kernel版本是64 bit：

```bash
$ cat common/common14-5.15/gki_image/release/gki-info.txt
certify_bootimg_extra_args=--prop ARCH:arm64 --prop BRANCH: --prop KERNEL_RELEASE:5.15.192-android14-11-gf81cc694a5db-ab14198814
kernel_release=5.15.192-android14-11-gf81cc694a5db-ab14198814
```

确认 base device tree 配置:

```bash
$ rg dtb-y common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/customer/
common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/customer/Makefile
2:dtb-y += t6x_t966d5_bu30a4_3g.dtb
3:dtb-y += t6x_t966d5_bu30a4_4g.dtb
4:dtb-y += t6x_t966d5_bu30a4_6g.dtb
```

确认当前机型设备使用的 dtb 是 `t6x_t966d5_bu30a4_4g.dtb`：

```bash
$ adb shell cat /proc/device-tree/compatible
t6x_t966d5_bu30a4-4g
```

确认语音模块 dts 不是被编译进android_overlay_dt.dtbo，而是 `t6x_t966d5_bu30a4_4g.dtb`：

```bash
$  rg audio common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/customer/t6x_t966d5_bu30a4_4g.dts
13:#include "mesont6x_audio.dtsi"
```

这也是动态切换方案一开始失败的根因：

```text
原理解：
把验证过的板端 dtbo.img 改名为 4mic_3amp_10ch_dtbo.img，recovery 写入 dtbo 分区，就能切换成 10ch。

实际情况：
这个 dtbo.img 不包含 audio 配置，10ch 差异来自 base DTS/DTB，所以 recovery 写 dtbo 分区并不会改变 loopback@0 的音频属性。
```

问题本质变成了：需要把 audio 差异真正做进 dtbo overlay。

## 陷阱 2：把 6ch 和 10ch 都打进原 dtbo.img

内核 DTS Makefile 里有类似配置：

```make
dtbo-y += android_overlay_dt.dtbo
```

Amlogic 构建脚本会收集编译出来的 `.dtbo`，再用 `mkdtimg` 生成总的 `dtbo.img`。

第二版本的思路，在 Makefile 里把下面两个目标都加进去：

```make
dtbo-y += 4mic_3amp_10ch_overlay_dt.dtbo
dtbo-y += 2mic_2amp_6ch_overlay_dt.dtbo
```

它们就可能一起进入原始 `dtbo.img`。这不是我们想要的。

原因是 6ch 和 10ch 都覆盖同一个节点：

```text
/soc/audiobus@FE330000/loopback@0
```

并且覆盖同一批属性：

```dts
datain_chnum
datain_chmask
datain-lane-mask-in
```

如果两套 overlay 同时生效，后应用的配置会覆盖先应用的配置，最终行为取决于加载顺序，很容易出问题。

## 陷阱 3：丢掉原 Android overlay

排查旧 dtbo 时还发现一个事实：原 `android_overlay_dt.dts` 虽然不含 audio 配置，但它并不是没用，它包含 dummy battery / dummy charger。

如果新做一个 audio-only dtbo，直接替换原 dtbo 分区，就会丢掉原来的 Android overlay 配置。这可能引入新的问题。

所以新的 4mic/2mic 镜像必须同时包含：

```text
fragment@0: dummy-battery
fragment@0: enable hdr10plus
fragment@1: dummy-charger
fragment@2: 远场语音 audio overlay
```

这也是为什么后面没有只编译 `4mic_3amp_10ch_overlay_dt.dts`，而是让 `android_overlay_dt.dts` 作为主文件，通过 include 引入 2mic 或 4mic 音频片段。这样每个最终 img 都保留原 Android overlay 能力。

## 最终方案：android_overlay_dt.dts 打补丁

最终采用的是最简单、最可控的方式，`android_overlay_dt.dts` 基础上按需 `include` audio  overlay dts 配置文件：

```dts
/include/ "2mic_2amp_6ch_overlay_dt.dts"
// /include/ "4mic_3amp_10ch_overlay_dt.dts"
```

生成脚本临时切换这两行注释状态，先生成 4mic，再生成 2mic，最后恢复源码。这样不需要改 Amlogic 原始构建流程，也不会让 6ch/10ch 同时进入原 `dtbo.img`。

DTS Overlay 配置：

```bash
$ rg dtbo-y common/common14-5.15/common/common_drivers/arch/arm64/boot/dts
common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/amlogic/Makefile
6:dtbo-y += android_overlay_dt.dtbo
7:dtbo-y += adt4_overlay_dt.dtbo
```

主 overlay 文件：

```text
common/common14-5.15/common/common_drivers/arch/arm64/boot/dts/amlogic/android_overlay_dt.dts
```

它保留 Android 原有 dummy battery / dummy charger 配置，并 include 当前默认 6ch 配置：

```dts
/dts-v1/;
/plugin/;

/ {
    fragment@0 {
        target-path="/";
        __overlay__ {
            dummy-battery {
                compatible = "amlogic, dummy-battery";
                status = "okay";
            };
        };
    };

    fragment@1 {
        target-path="/";
        __overlay__ {
            dummy-charger {
                compatible = "amlogic, dummy-charger";
                status = "okay";
            };
        };
    };

    /include/ "2mic_2amp_6ch_overlay_dt.dts"
    // /include/ "4mic_3amp_10ch_overlay_dt.dts"
};
```

2mic 片段文件 2mic_2amp_6ch_overlay_dt.dts，它不是完整 DTS，而是可被 include 的 fragment：

```dts
fragment@2 {
    target-path = "/soc/audiobus@FE330000/loopback@0";
    __overlay__ {
        datain_chnum = <2>;
        datain_chmask = <0x3>;
        datain-lane-mask-in = <1 0 0 0>;
        datalb_chnum = <4>;
        datalb_chmask = <0xf>;
        datalb-lane-mask-in = <1 1 0 0>;
    };
};
```

4mic 片段文件 4mic_3amp_10ch_overlay_dt.dts 内容类似，只是参数换成 4mic+3amp/10ch：

```dts
fragment@2 {
    target-path = "/soc/audiobus@FE330000/loopback@0";
    __overlay__ {
        datain_chnum = <4>;
        datain_chmask = <0xf>;
        datain-lane-mask-in = <1 1 0 0>;
        datalb_chnum = <6>;
        datalb_chmask = <0x3f>;
        datalb-lane-mask-in = <1 1 1 0>;
    };
};
```

注意： `target-path` 必须对准 running DTS 里的真实节点路径。路径不对时，dtbo 可能能编译出来，但启动时 overlay 应用失败，running DTS 仍然不会变。

## 生成脚本：临时切换 include 并生成两个镜像

这套脚本化方案没有改 Amlogic 原始构建脚本，也没有让 `Makefile` 直接生成两个独立最终 img。这样做是为了控制复杂度。

它的核心思想是：

1. `android_overlay_dt.dts` 默认启用的 include 2mic/6ch 配置。
2. 生成脚本临时切换 include，分别生成两个镜像。
3. 原始 `dtbo.img` 不同时包含 6ch 和 10ch，避免覆盖同一节点造成不确定行为。
4. onebin 根据 `model.ini:FARFIELD_AUDIO` 明确烧录对应镜像。

这种方式简单、可验证、出问题时也容易回退。

生成结果：

```text
4mic_android_overlay_dt.dtbo
4mic_3amp_10ch_dtbo.img
2mic_android_overlay_dt.dtbo
2mic_2amp_6ch_dtbo.img
```

dtbo.img生成链路如下，以4mic/10ch为例：

```text
android_overlay_dt.dts
  |
  | 临时启用 4mic include，注释 2mic include
  v
4mic_android_overlay_dt.dtbo
  |
  | mkdtimg create
  v
4mic_3amp_10ch_dtbo.img
```

## 如何动态切换dtbo.img

每个机型的 `model.ini` 新增字段：

```ini
FARFIELD_AUDIO = 4mic_3amp_10ch_dtbo.img
;FARFIELD_AUDIO = 2mic_2amp_6ch_dtbo.img
```

recovery onebin 逻辑读取这个字段后，把对应镜像烧录到 `dtbo` 分区。

这就是动态选择的关键：不是让 bootloader 从一个大 `dtbo.img` 里猜该用哪个 overlay entry，而是 onebin 明确烧录当前机型需要的哪个镜像。

## 如何验证生成结果

### 1. 检查镜像大小

```sh
stat -c '%s %n' *_dtbo.img
```

期望两个 img 都是 2MB：

```text
2097152 4mic_3amp_10ch_dtbo.img
2097152 2mic_2amp_6ch_dtbo.img
```

### 2. 反编译 4mic 中间产物

```sh
prebuilts/misc/linux-x86/dtc/dtc -I dtb -O dts  4mic_android_overlay_dt.dtbo
```

应看到：

```dts
datain_chnum = <0x4>;
//...
```

同时还应看到 dummy battery / dummy charger fragment，说明原 Android overlay 配置没有丢。

### 如果上板后仍不生效，下一步查什么

如果后续上板验证发现 running DTS 仍然没有变，不要先怀疑 tinycap。按顺序查：

1. `adb shell md5sum /dev/block/by-name/dtbo`，确认分区内容是否是新镜像。
2. 如果设备是 A/B 分区，检查 `dtbo_a` / `dtbo_b` 是否写到了当前 active slot。
3. 导出 `/sys/firmware/fdt`，反编译 running DTS，看 `loopback@0` 是否真的变成 4mic/10ch。
4. 查 kernel log：`dmesg | grep -i -E "dtbo|overlay|fdt|ufdt|audio|loopback"`。
5. 如果 running DTS 已经变成 10ch，但录音仍只有 2 路，再转向 ALSA/mixer/HAL 排查。

这个顺序能避免把 DTS 问题、分区写入问题、bootloader apply 问题、音频用户态问题混在一起。

## 总结

本次远场语音 DTBO 改造可以概括为一句话：

> 把 2mic/4mic 差异从基础 DTS 中拆出去，用 overlay 描述差异，再用脚本生成两个明确命名的 dtbo.img，最后由 onebin 根据机型配置选择烧录。

它们都包含原 Android overlay 配置，并且分别只包含自己机型对应的远场语音音频参数，不会互相覆盖。
