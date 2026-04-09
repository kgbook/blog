---
layout: post
title: segfault 问题分析
date: 2018-06-09
categories:
- Linux
tags: 
- Linux
---

本文结合过往项目经验，介绍了内存分段管理的起源，总结了一下遇到 `segmentation fault` 问题时如何调试。

## 关于段

### 段的含义

> A segment, in the 8086/8088 is a 64kb chunk of memory addressable by any particular value in a segment register. Specifically, there are four segment registers, Code Segment, Data Segment, Stack Segment, and Extra Segment.

段是一块 64 KB 的可寻址的内存空间，8086/8088 CPU 中主要有四种段，代码段 (CS)，数据段 (DS)，堆栈段 (SS) 和 附加段（ES）。

### 内存分段管理的起源

> Each is used in the context of a particular instruction by multiplying the segment register by 16 (left shift 4) and then adding the particular offset contained in the instruction. This gives access to 1Mb of memory (a 20 bit address bus) using only a 16 bit segment register and a 16 bit offset but, in only one instruction, you only have access to 64kb at a time. It would take two instructions to access any location in memory; one to load the segment register, and one to access the desired location. 

8086 CPU 有 20 根地址线，最大可寻址内存空间为 2^20 byte 即 1 MB. 然而 8086 的寄存器（IP, SI, DI 等）只有 16 位，16 位的地址最大可寻址区域位 2^16 byte 即 64 KB，为了实现对 1 MB 内存空间的寻址，引入了内存分段。 1 MB 空间划分为 2^4 即 16 个段，每个段内存空间不超过 64 KB。


## 关于段错误

> In computing, a segmentation fault (often shortened to segfault) or access violation is a fault, or failure condition, raised by hardware with memory protection, notifying an operating system (OS) the software has attempted to access a restricted area of memory (a memory access violation). 

段错误指非法访问错误的内存空间的行为，例如访问了只读的内存地址，或者系统保护的内存地址。

sample-1：

```c
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
    char *pcStr = "Hello, beauty!";

    strcpy(pcStr, "Hello, AlphaGo!");
    printf("%s\n", pcStr);
    
    return 0;
}
```

查看可执行程序对应section的内容：

```shell
kang $ gcc test.c -g -Wall
kang $ objdump -s a.out
```
目标文件`a.out`的构成`__cstring section`部分截图：

![objdump section.png](images/segfault-sample-objdump.png "objdump section.png")

`kang $ size -x -l -m a.out`

目标文件各section布局(Mac OSX环境)：

![section size.png](images/segfault-sample-section-size.png "section size.png")


字符串常量存储于 `__cstring section` ，该section位于 `__TEXT segment`。`__TEXT` 以可读和可执行的方式映射，即 `pcStr` 指向了一个可读的内存区域，无法进行写操作。

## 调试手段

### 1. 利用gdb 和 core dump 文件定位问题

配置 core dump 文件大小限制，生成 core 文件，`gdb` 调试，`backtrce` 观察 call stacks。

- 方法1，`ulimit -c unlimited`。

- 方法2，`setrlimit` 系统调用。

```c
#include <sys/resource.h>

void enableCoreDump(void)
{
    struct rlimit stCoreLimit = {.rlim_cur = -1, .rlim_max = -1;};

    if (0 != setrlimit(RLIMIT_CORE, &stCoreLimit))
    {
        printf("[%s:%d]Couldn't set core limit!\n", __func__, __LINE__);
        return ;
    }

    return ;
}
```

sample-2:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SUCCESS   (0)
#define FAILURE  (-1)

#define	PRINT_DEBUG
#define	HELLO_STR   "hello, github!"

#ifdef PRINT_DEBUG
#define print_debug(format, args...)   printf("[%s:%d]"format"\n", __func__, __LINE__, ##args)
#endif

#define  CHECK_PTR_RET(ptr, ret) \
do\
{\
    if (NULL == ptr)\
    {\
        print_debug("NULL pointer!");\
        return ret;\
    }\
}while(0)

#define  CHECK_FUNC_RET(func_expr, ret_expr, ret)\
do\
{\
    if (!(ret_expr))\
    {\
        print_debug("%s failed, ret = 0x%x", func_expr, ret);\
        return ret;\
    }\
}while(0)

int GetMem(void *pMem, int slLen)
{
    //CHECK_PTR_RET(pMem, FAILURE);
    pMem = malloc(slLen);

    return SUCCESS;
}

int main(int argc, char **argv)
{
    char *acBuf = NULL;
    int slLen = 1 << 8;
    int slRet = SUCCESS;

    slRet = GetMem((void *)acBuf, slLen);
    CHECK_FUNC_RET("GetMem()", SUCCESS == slRet, FAILURE);

    strncpy(acBuf, HELLO_STR, strlen(HELLO_STR));
    printf("%s\n", acBuf);

    return SUCCESS;
}

```

```shell
$ gcc test.c -o test -g  -Wall
$ ./test
```

`gdb test core` , 提示：

> Missing separate debuginfo

根据提示， 安装kernel debuginfo。

call stacks信息：

```shell
(gdb) bt
#0  0x0000003d24e896d1 in memcpy () from /lib64/libc.so.6
#1  0x0000000000400641 in main (argc=1, argv=0x7ffcc9a37ca8) at test.c:52
(gdb) f 1
#1  0x0000000000400641 in main (argc=1, argv=0x7ffddcb629b8) at test.c:52
Line number 52 out of range; test.c has 7 lines.
(gdb) info locals
acBuf = 0x0
slLen = 256
slRet = 0
__func__ = "main"
```

由上结果，程序运行结束到 `test.c:52`，`acBuf` 仍为 `0x0`, 我们进一步验证：

```shell
(gdb) b 38
Breakpoint 1 at 0x4005a3: file test.c, line 38.
(gdb) b 40 
Breakpoint 2 at 0x4005b4: file test.c, line 40.
(gdb) b 50
Breakpoint 3 at 0x4005f4: file test.c, line 50.
(gdb) r
Starting program: /home/kangdl/test 

Breakpoint 1, GetMem (pMem=0x0, slLen=256) at test.c:38
Line number 38 out of range; test.c has 7 lines.
Missing separate debuginfos, use: debuginfo-install glibc-2.12-1.209.el6_9.2.x86_64
(gdb) c
Continuing.

Breakpoint 2, GetMem (pMem=0x601010, slLen=256) at test.c:40
Line number 40 out of range; test.c has 7 lines.
(gdb) c
Continuing.

Breakpoint 3, main (argc=1, argv=0x7fffffffe528) at test.c:50
Line number 50 out of range; test.c has 7 lines.
(gdb) p acBuf
$2 = 0x0
```

`pMem` 传入为 `0x0`，`malloc()` 后 `pMem` 被赋值为 `0x601010`, `GetMem()` 调用结束后，`acBuf` 仍为 `0x0`！`strncpy`时访问了`0x0`的内存地址，非法访问了操作系统的起始地址。

### 2. Valgrind 内存检测工具

[valgrind官网](http://valgrind.org/)下载源代码，编译安装。

仍然使用 `sample-2` 的可执行程序，`Valgrind` 工具定位内存问题。

```shell
$ valgrind --tool=memcheck --leak-check=full --show-reachable=yes  ./test
==23766== Memcheck, a memory error detector
==23766== Copyright (C) 2002-2012, and GNU GPL'd, by Julian Seward et al.
==23766== Using Valgrind-3.8.1 and LibVEX; rerun with -h for copyright info
==23766== Command: ./test
==23766== 
==23766== Invalid write of size 1
==23766==    at 0x4A08CBF: memcpy (mc_replace_strmem.c:882)
==23766==    by 0x400640: main (test.c:52)
==23766==  Address 0x0 is not stack'd, malloc'd or (recently) free'd
==23766== 
==23766== 
==23766== Process terminating with default action of signal 11 (SIGSEGV): dumping core
==23766==  Access not within mapped region at address 0x0
==23766==    at 0x4A08CBF: memcpy (mc_replace_strmem.c:882)
==23766==    by 0x400640: main (test.c:52)
==23766==  If you believe this happened as a result of a stack
==23766==  overflow in your program's main thread (unlikely but
==23766==  possible), you can try to increase the size of the
==23766==  main thread stack using the --main-stacksize= flag.
==23766==  The main thread stack size used in this run was 10485760.
==23766== 
==23766== HEAP SUMMARY:
==23766==     in use at exit: 256 bytes in 1 blocks
==23766==   total heap usage: 1 allocs, 0 frees, 256 bytes allocated
==23766== 
==23766== 256 bytes in 1 blocks are definitely lost in loss record 1 of 1
==23766==    at 0x4A06A2E: malloc (vg_replace_malloc.c:270)
==23766==    by 0x4005AF: GetMem (test.c:38)
==23766==    by 0x4005F0: main (test.c:49)
==23766== 
==23766== LEAK SUMMARY:
==23766==    definitely lost: 256 bytes in 1 blocks
==23766==    indirectly lost: 0 bytes in 0 blocks
==23766==      possibly lost: 0 bytes in 0 blocks
==23766==    still reachable: 0 bytes in 0 blocks
==23766==         suppressed: 0 bytes in 0 blocks
==23766== 
==23766== For counts of detected and suppressed errors, rerun with: -v
==23766== ERROR SUMMARY: 2 errors from 2 contexts (suppressed: 8 from 6)
Segmentation fault (core dumped)
```

检测出两个问题：

issue-1, 存在非法访问内存问题，`test.c:52` 处即 `strncpy()` 非法写操作；

```shell
==23766== Invalid write of size 1
==23766==    at 0x4A08CBF: memcpy (mc_replace_strmem.c:882)
==23766==    by 0x400640: main (test.c:52)
==23766==  Address 0x0 is not stack'd, malloc'd or (recently) free'd
```

issue-2， 存在内存泄漏，`HEAP SUMMARY` 提示 `GetMem()` 调用中 `malloc()` 的内存未 `free()`！

### 3. 捕捉 SIGSEGV 并 backtrace 调用栈信息

sample-3：

```c
#include <stdio.h>
#include <execinfo.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

void DebugBacktrace(int signo) 
{
  void *array[10];
  size_t size;

  size = backtrace(array, 10);
  fprintf(stderr, "Error: signal %d:\n", signo);
  backtrace_symbols_fd(array, size, STDERR_FILENO);
  exit(1);
}

void StringOperation(void) 
{
    char *pcStr = "Hello, beauty!";
    strcpy(pcStr, "Hello, AlphaGo!"); //Cause segfault
    printf("[%s:%d]%s\n", __func__, __LINE__, pcStr);
}

void OperationWrap() 
{
    StringOperation();
}

int main(int argc, char **argv) 
{
    struct sigaction stSigAction;
#if 0
    signal(SIGSEGV, DebugBacktrace);
#else    
    stSigAction.sa_flags = SA_SIGINFO;
    stSigAction.sa_sigaction = (void *)DebugBacktrace;
    sigaction(SIGSEGV, &stSigAction, NULL);
#endif    
    OperationWrap(); 
    
    return 0;
}
```

编译时，注意加 `-rdynamic` 选项:

`gcc backtrace.c -o backtrace -g -Wall -rdynamic `

运行结果:

```shell
./backtrace
Error: signal 11:
./backtrace(DebugBacktrace+0x1c)[0x400960]
/lib64/libc.so.6[0x3d24e32510]
/lib64/libc.so.6(memcpy+0x67)[0x3d24e89717]
./backtrace(StringOperation+0x29)[0x4009d1]
./backtrace(OperationWrap+0x9)[0x4009ff]
./backtrace(main+0x4e)[0x400a4f]
/lib64/libc.so.6(__libc_start_main+0xfd)[0x3d24e1ed1d]
./backtrace[0x400889]
```

由此判断 `StringOperation()` 的 `memcpy()` 操作时 segfault。

### 4. dmesg

仍然使用 `sample-2` 的可执行程序，运行后 `dmesg`：

>test[24667]: segfault at 0 ip 0000003d24e896d1 sp 00007ffd54f58418 error 6 in libc-2.12.so[3d24e00000+18a000]

segfault 发生在内存地址为`0`的地方，此时`ip`指针为`0000003d24e896d1`, `sp`指针为`00007ffd54f58418`，使用 `addr2line` 工具 来定位 `segfault` 的具体行号。

Mac OSX 需要安装 [addr2line](https://springrts.com/phpbb/viewtopic.php?t=26240) 工具包, `brew install binutils` 。

![addr2line.png](images/addr2line.png "addr2line.png")

### 5. 清理编译告警

部分段错误可以通过提高编译告警等级, 开启 `gcc` 的 `-Werror` 选项，通过清理编译告警来解决。

sample-4：

```c
int print_buf(char *acBuf)
{
    CHECK_PTR_RET(acBuf, FAILURE);
    printf("%s\n", acBuf);
    return SUCCESS;
}

int main(int argc, char **argv)
{
    char acStr[] = "hello, github!";
    print_buf(acStr[0]);
    return SUCCESS;
}
```

未提高编译告警等级前，编译顺利通过。

```shell
$ gcc test.c  -o test -g -Wall
test.c: In function ‘main’:
test.c:45: warning: passing argument 1 of ‘print_buf’ makes pointer from integer without a cast
test.c:35: note: expected ‘char *’ but argument is of type ‘char’
```

提高编译告警等级后，`Warning` 转换为 `Error`，编译不通过, 提示数据类型不一致。

```shell
$ gcc test.c  -o test -g -Wall -Werror
cc1: warnings being treated as errors
test.c: In function ‘main’:
test.c:45: error: passing argument 1 of ‘print_buf’ makes pointer from integer without a cast
test.c:35: note: expected ‘char *’ but argument is of type ‘char’
```

`print_buf()` 传入参数 `acStr[0]`, 数据类型为 `char`, 而其 function prototype 的第一个参数数据类型为`char *`， 提高编译告警等级后编译时失败。

### 6. 其它方式

6.1 "code review"，同行评审也是不错的方式。

6.2 在可能segfault的地方`printf()`等。

## 解决方案

针对 `sample-1` 以及 `sample-3`，改为 `char pcStr[256] = "Hello, beauty!";`，给 `pcStr`分配足够大小的内存，此处用的栈内存。

针对 `sample-2`，我们可以传入二级指针作为函数参数，代码修改如下：

```c
int GetMem(void **pMem, int slLen)
{
    CHECK_PTR_RET(pMem, FAILURE);
    *pMem = malloc(slLen);

    return SUCCESS;
}

int main(int argc, char **argv)
{
    char *acBuf = NULL;
    int slLen = 1 << 8;
    int slRet = SUCCESS;

    slRet = GetMem((void **)&acBuf, slLen);
    CHECK_FUNC_RET("GetMem()", SUCCESS == slRet, FAILURE);

    strncpy(acBuf, HELLO_STR, strlen(HELLO_STR));
    printf("%s\n", acBuf);

    free(acBuf);

    return SUCCESS;
}
```

注意，`Valgrind memcheck` 仍会报一个错误.

```shell
==24573== 1 errors in context 1 of 1:
==24573== Conditional jump or move depends on uninitialised value(s)
==24573==    at 0x4A07FC8: __GI_strlen (mc_replace_strmem.c:404)
==24573==    by 0x3D24E6884A: puts (in /lib64/libc-2.12.so)
==24573==    by 0x4006CC: main (test.c:53)
==24573==  Uninitialised value was created by a heap allocation
==24573==    at 0x4A06A2E: malloc (vg_replace_malloc.c:270)
==24573==    by 0x400629: GetMem (test.c:38)
==24573==    by 0x400670: main (test.c:49)
```

解决这错误只需要对该内存块做一次初始化操作，`memset(*pMem, 0, 1 << 8);` 或改为 `calloc()`分配内存：`calloc(1, 1 << 8)`。

针对sample-4，修改为 `print_buf(acStr + 0);` 或 `print_buf(acStr);`。

## 参考文献 ##

1. [What is segmentation ?](http://www.answers.com/Q/What_is_segmentation)
2. [Segmentation fault](https://en.wikipedia.org/wiki/Segmentation_fault)
3. [How to automatically generate a stacktrace when my gcc C++ program crashes](https://stackoverflow.com/questions/77005/how-to-automatically-generate-a-stacktrace-when-my-gcc-c-program-crashes)
4. [sigaction manual](https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.1.0/com.ibm.zos.v2r1.bpxbd00/rtsigac.htm)
5. [What is the difference between sigaction and signal?
](https://stackoverflow.com/questions/231912/what-is-the-difference-between-sigaction-and-signal)
6. [how to enable core dump in my linux c program](https://stackoverflow.com/questions/2919378/how-to-enable-core-dump-in-my-linux-c-program)
7. [size man page](https://linux.die.net/man/1/size)
