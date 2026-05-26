+++
title = "从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "Ralph", "Agent 编排", "自动化"]
+++

大多数人使用 AI 编程，是一次性提示：

```text
帮我实现这个功能。
```

AI 写一轮代码，然后停下来。你检查，发现有问题，再继续提示。这个模式简单，但它有一个明显缺点：循环在你脑子里。

你负责判断下一步、提醒它测试、指出失败、要求修复、确认完成。AI 只是每次被动响应。

Ralph Loop 代表另一种思路：把“计划、实现、检查、收尾”做成循环系统，让 Agent 在明确规则下持续工作，直到满足完成条件。

这就是 Harness Engineering 从“提示词技巧”走向“执行系统”的关键一步。

## 什么是 Ralph Loop

Ralph 最早可以理解成一个很朴素的自动化循环：

```text
读取任务 -> 让 Agent 工作 -> 检查结果 -> 如果没完成就继续 -> 完成后停止
```

它的重点不是某个具体工具，而是一种模式：

- 每轮有明确角色。
- 每轮读取持久化上下文。
- 每轮产出写回磁盘。
- 每轮受到测试和检查约束。
- 最后通过明确完成信号退出。

这和普通聊天最大的区别是：Ralph 把循环外化了。

普通聊天：

```text
人类负责循环。
AI 负责单次回答。
```

Ralph Loop：

```text
Harness 负责循环。
AI 负责每轮执行。
人类负责目标和验收。
```

## 一个实际实验

我的学习仓库里做过一个 Ralph Orchestrator 小实验：让 Agent 从零写一个 Python CLI 词频统计工具。

任务很简单：创建 `wc.py`，接收文件名，统计行数、单词数、字符数，并写 pytest 测试。

人类只写了一个 `PROMPT.md`：

```markdown
# Task: Build a CLI word counter

Create a simple Python CLI tool called `wc.py` that:
1. Accepts a filename as argument
2. Counts lines, words, and characters
3. Prints the result in a formatted table

Include a test file `test_wc.py` using pytest.

When all tests pass, output LOOP_COMPLETE.
```

注意这个任务里有几个 Harness 要素：

- 目标清楚。
- 产物清楚。
- 测试要求清楚。
- 完成信号清楚。

最后 Ralph 跑了 4 轮，耗时 321 秒，费用约 0.31 美元。

## 四个角色

这次实验里，循环大致分成四个角色。

### Planner：拆任务

Planner 不急着写代码，而是先读任务、拆步骤、记录计划。

它的价值是减少一上来就乱写的风险。

输出类似：

```text
需要实现 wc.py。
需要编写 pytest。
需要验证正常文件、空文件、缺失文件、无参数。
```

### Builder：实现

Builder 负责写代码和测试。

在实验里，它先写了 `test_wc.py`，再写 `wc.py`，运行测试后发现字符计数有问题，又修复，直到 7 个测试通过。

这里重要的不是代码量，而是循环：

```text
写测试 -> 写实现 -> 跑测试 -> 修失败
```

### Critic：独立复查

Critic 用新一轮上下文重新检查结果。

它做了两件事：

- 独立重跑 pytest。
- 手动验证正常、无参数、文件缺失、空文件、无换行等 CLI 路径。

这相当于让另一个视角检查 Builder 是否自我感觉良好。

### Finalizer：收尾

Finalizer 检查任务要求是否全部满足。如果满足，输出 `LOOP_COMPLETE`。

这个完成信号很重要。没有明确结束条件，Agent 可能过早停止，也可能无限打磨。

## scratchpad：跨轮记忆

Ralph 会把每轮结果写到 scratchpad。

这很像一个小型工作日志：

```text
Iteration 1: Planner decomposed task.
Iteration 2: Builder wrote tests and implementation.
Iteration 3: Critic verified CLI paths.
Iteration 4: Finalizer confirmed completion.
```

为什么不只靠模型上下文？

因为长任务里，上下文可能被压缩、遗忘、截断。磁盘文件更稳定。下一轮 Agent 可以重新读取 scratchpad，知道之前发生了什么。

这正是 Harness Engineering 的“仓库即记录系统”原则。

## 背压门控

Ralph Loop 不需要规定 Builder 每一行怎么写。它只规定坏结果不能通过。

在这个实验里，门控是 pytest：

```text
测试不通过，就不能进入完成状态。
```

这叫背压。它不微观管理实现过程，只在结果不合格时施加压力。

更复杂的项目里，背压可以包括：

- 单元测试
- lint
- 类型检查
- 架构检查
- Playwright UI 测试
- 安全扫描
- Reviewer Agent 审查

关键是：Agent 可以自由尝试，但必须过门。

## 从单次提示到循环系统

对比一下两种方式。

普通提示：

```text
User -> Agent -> Code
User review -> Agent fix -> Code
User review -> Agent fix -> Code
```

Ralph Loop：

```text
Task file -> Planner -> Builder -> Tests -> Critic -> Finalizer
                 ^          |         |        |
                 |          v         v        v
              scratchpad <- failures <- checks <- done signal
```

普通提示里，人类是调度器。Ralph Loop 里，Harness 是调度器。

这能减少人的重复操作，但前提是任务足够清楚，检查足够可靠。

## 什么时候适合用循环

适合：

- 有明确完成条件的编码任务。
- 能用测试验证的功能。
- 重复性强的批量修改。
- 多步骤但边界清楚的重构。
- 文档生成、翻译、格式整理等流水线任务。

不适合：

- 产品方向还没想清楚。
- 架构决策高度开放。
- 缺少验证手段。
- 安全风险高、错误代价大的任务。
- 需要大量人类品味判断的 UI/交互探索。

判断标准很简单：

```text
如果你说不清“完成长什么样”，就不要先上循环。
```

## 如何给循环写任务

Ralph 类任务文件要比普通聊天更严谨。

建议包含：

```markdown
# Task

## Goal

最终用户能做什么。

## Requirements

- 必须满足的行为。
- 必须保留的旧行为。
- 不允许做的事。

## Verification

- 需要新增或通过的测试。
- 需要运行的命令。
- 手动验证路径。

## Completion Signal

When all checks pass, output TASK_COMPLETE.
```

完成信号不要模糊。比如：

```text
When all tests pass and requirements are met, output LOOP_COMPLETE.
```

这让循环知道何时停下。

## 一个可以复用的轻量版 Ralph

不安装 Ralph，也可以手动模拟这个模式。

你可以准备三个提示模板：

### Planner

```text
Read AGENTS.md and the task file.
Do not edit files.
Produce an implementation plan, risks, and verification steps.
```

### Builder

```text
Follow the approved plan.
Edit files.
Run the required checks.
Fix failures.
Summarize changes and remaining risks.
```

### Reviewer

```text
Review the diff against AGENTS.md and the task file.
Focus on bugs, missing tests, architecture violations, and edge cases.
Do not rewrite code unless asked.
```

这就是个人版循环。虽然没有完全自动化，但已经把角色分开了。

## 循环的风险

### 风险一：任务错了，循环会高效做错事

如果任务文件本身方向错，循环只会更快把错误实现完。

所以复杂任务要先让 Planner 输出计划，人类确认后再执行。

### 风险二：检查太弱

如果只有很少测试，Agent 可能通过检查但行为仍然不对。

循环越自动化，验证越要强。

### 风险三：成本失控

长循环可能跑很久。要设置：

- 最大轮数
- 最大时间
- 明确停止条件
- 失败后报告而不是无限重试

### 风险四：过度自信

Finalizer 输出完成，不代表人类可以完全不看。它只是说明 Harness 认为条件满足。

## 小结

Ralph Loop 的意义，不是让 AI 神奇地全自动开发，而是把人的重复调度动作工程化：

```text
计划由 Planner 做。
实现由 Builder 做。
检查由 Critic 做。
收尾由 Finalizer 做。
状态写入 scratchpad。
质量由测试和门控约束。
```

当任务清楚、验证可靠时，这种循环能显著提高效率。它让人从“每一步都盯着 AI”变成“设计任务、设置门控、验收结果”。

这正是 Harness Engineering 的核心转变。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
