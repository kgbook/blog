+++
title = "不只写代码：用 Harness Engineering 批量翻译技术文章"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "技术翻译", "工作流", "内容生产"]
+++

Harness Engineering 经常被放在 AI 编程语境里讨论。但它的本质并不是“让 AI 写代码”，而是“让 AI 在约束和反馈中可靠完成复杂任务”。

所以它也可以用于非代码场景。

我在学习 Harness Engineering 的过程中，做过一个很典型的实践：两周内翻译 11 篇高质量技术文章，其中包括学术论文。纯人工翻译太慢，纯 AI 翻译质量又不稳定。最后真正有效的，不是写一个神奇提示词，而是搭了一套翻译 Harness。

这篇文章就用这个案例说明：Harness Engineering 如何迁移到技术写作和翻译。

## AI 翻译的问题

技术文章翻译看起来很适合 AI。给原文，输出中文，好像很简单。

但真实使用会遇到很多问题：

- 术语前后不一致。
- 句子有明显翻译腔。
- 学术论文里的结构和引用容易乱。
- 长文上下文丢失。
- 代码、公式、HTML 标记被破坏。
- 同一个概念在不同文章中被翻成不同词。

比如 Harness 这个词，翻成“线束”“工具链”“框架”“驭缰”都可能出现。如果一篇文章里来回变，读者会很痛苦。

所以翻译任务也需要 Harness：

```text
约束术语。
约束风格。
约束分块。
保留中间产物。
引入批判和修订。
检查格式残留。
```

## 翻译里的 Harness 长什么样

在代码场景里，Harness 可能包括 `AGENTS.md`、lint、测试、CI。

在翻译场景里，对应关系是：

| 代码 Harness | 翻译 Harness |
|---|---|
| AGENTS.md | 翻译配置 |
| lint 规则 | 术语表 |
| 测试 | 格式和术语检查 |
| Reviewer Agent | critique 阶段 |
| 重构 | 修订和润色 |
| scratchpad | analysis/draft/revision 中间文件 |

本质完全一样：人类定义什么是好结果，AI 负责执行，Harness 负责约束和反馈。

## 约束文件：翻译版 AGENTS.md

翻译工作流首先需要一个配置文件，定义目标。

例如：

```yaml
target_language: zh-CN
audience: technical
style: natural technical Chinese
mode: refined
chunk_max_words: 5000
```

它回答几个问题：

- 翻译给谁看？
- 应该是什么语气？
- 保留哪些英文术语？
- 长文如何分块？
- 是否需要审查和修订？

这和代码项目的 `AGENTS.md` 很像。它不是具体翻译某一句，而是定义整个任务环境。

## 术语表：翻译领域的 Lint

术语表是翻译 Harness 里最高杠杆的组件。

例如：

```text
Harness -> Harness
Agent -> 智能体
Feedforward -> 前馈
Feedback -> 反馈
Backpressure -> 背压
AGENTS.md -> AGENTS.md
```

它的作用和 lint 很像：不规定每句话怎么翻，但规定关键不变量。

代码里的 lint 会说：

```text
不要用 console.log，用 structured logger。
```

翻译里的术语表会说：

```text
不要把 Harness 翻成“线束”，保留 Harness。
```

这能避免长文和多篇文章之间的术语漂移。

## 五轮流水线

一次性翻译通常不够稳定。更好的方式是分阶段。

我使用的 refined 模式可以拆成五轮：

```text
1. analysis：分析原文领域、语气、术语和难点
2. prompt：组装翻译指令、术语表和风格要求
3. draft：生成初稿
4. critique：批判性审查
5. revision：根据审查修订
```

这就是反馈飞轮。

最关键的是 critique 和 revision 分开：

- critique 只诊断问题。
- revision 再执行修复。

如果让同一轮同时翻译、审查、修复，模型很容易自我感觉良好。分阶段能逼它重新看问题。

## 分块：让长文进入 AI 的甜点区

长文翻译最怕上下文太长。一次塞进去，模型可能：

- 前后术语不一致。
- 后半部分质量下降。
- 格式损坏。
- 漏段。

更稳妥的是分块。

例如一篇 19500 字的论文，可以拆成 5 个 chunk，每块约 4000 到 5000 字。

关键是所有 chunk 共享同一份翻译 prompt 和术语表：

```text
chunk 1 -> shared prompt + glossary
chunk 2 -> shared prompt + glossary
chunk 3 -> shared prompt + glossary
chunk 4 -> shared prompt + glossary
chunk 5 -> shared prompt + glossary
```

这样可以并行翻译，同时保持一致性。

这和多 Agent 编码很像：每个 Agent 处理局部任务，但共享同一套规则。

## 中间产物比最终产物更重要

很多人只保存最终翻译。这样有个问题：一旦发现质量问题，你不知道问题来自哪里。

更好的方式是保存每一轮产物：

```text
01-analysis.md
02-prompt.md
03-draft.md
04-critique.md
05-revision.md
translation.md
```

这些文件记录了 AI 的判断过程。

当你发现某个术语翻错了，可以回看：

- analysis 有没有识别这个术语？
- prompt 有没有包含术语表？
- draft 是第一次翻错，还是 revision 改错？
- critique 有没有发现？

这就是“仓库即记录系统”在翻译场景里的体现。

## 格式传感器

翻译技术文章时，格式问题很常见。

比如：

- `<sup>` 标签残留。
- LaTeX `$\rightarrow$` 没清理。
- Markdown 链接损坏。
- 代码块语言标记丢失。
- 表格列数错位。

这些问题不应该全靠人眼查。可以做格式传感器：

```text
检查是否存在未处理 HTML 标签。
检查 Markdown 链接格式。
检查代码块是否闭合。
检查术语表里的禁用译法。
```

哪怕只是简单 `rg` 搜索，也能减少很多人工清理。

## 一个可复制的翻译 Harness

如果你想批量翻译技术文章，可以从这个结构开始：

```text
translation-project/
├── AGENTS.md
├── glossary.md
├── style-guide.md
├── source/
│   └── article.md
├── work/
│   ├── 01-analysis.md
│   ├── 02-prompt.md
│   ├── 03-draft.md
│   ├── 04-critique.md
│   └── 05-revision.md
└── output/
    └── article-zh.md
```

`style-guide.md` 可以写：

```markdown
# Style Guide

- Use natural technical Chinese.
- Avoid word-by-word translation.
- Preserve code blocks exactly.
- Preserve product and file names.
- Use consistent terms from glossary.md.
```

`glossary.md` 写：

```markdown
# Glossary

- Agent: 智能体
- Harness: Harness
- Feedback loop: 反馈回路
- Backpressure: 背压
```

然后每篇文章都走同一条流水线。

## 翻译任务提示模板

分析阶段：

```text
Read the source article.
Do not translate yet.
Identify domain, audience, tone, key terms, and translation risks.
Save the analysis.
```

翻译阶段：

```text
Translate the article into Simplified Chinese.
Follow glossary.md and style-guide.md.
Preserve Markdown structure and code blocks.
```

审查阶段：

```text
Review the translation for accuracy, terminology consistency, natural Chinese,
Markdown damage, and missing content.
Do not rewrite yet. List issues only.
```

修订阶段：

```text
Revise the translation according to the critique.
Preserve technical accuracy and Markdown structure.
```

这个流程比一个“请帮我翻译得专业一点”的提示稳定得多。

## 为什么这个案例重要

翻译案例说明 Harness Engineering 的概念是通用的。

只要任务满足这些条件，就可以用 Harness：

- 输出质量有标准。
- 错误类型可以总结。
- 可以分阶段执行。
- 可以保留中间产物。
- 可以引入反馈和修订。

所以它也适合：

- 批量写文档
- 整理会议纪要
- 生成培训材料
- 数据清洗
- 测试用例生成
- API 文档维护

本质不是代码，而是可控的 AI 工作流。

## 常见误区

### 误区一：翻译只要一个好提示词

提示词重要，但长文和批量任务需要术语表、分块、审查和修订。

### 误区二：AI 翻译完人工润色就行

如果没有中间记录，人工润色会很累，也很难复用经验。把错误沉淀成术语表和风格规则，下一篇才会更好。

### 误区三：分块一定导致不一致

如果没有共享术语表，确实会不一致。有共享 prompt 和 glossary，分块反而能提升质量。

### 误区四：非代码任务不需要检查

非代码任务同样需要传感器。只是测试从 `pytest` 变成了术语、格式、结构、风格检查。

## 小结

Harness Engineering 不只是 AI 编程方法，它是一种组织 AI 工作的方式。

翻译场景里：

```text
术语表就是 lint。
风格指南就是 AGENTS.md。
五轮翻译就是反馈飞轮。
分块并行就是多 Agent 分治。
中间文件就是持久记忆。
格式检查就是传感器。
```

当你理解这一点，就能把 Harness Engineering 从代码扩展到很多知识工作。AI 不再只是“生成一次结果”，而是在一个可复用的工作流里持续提高质量。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
