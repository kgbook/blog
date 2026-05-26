+++
title = "仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "AGENTS.md", "知识管理", "工程规范"]
+++

AI Agent 做项目时，最怕的不是不会写代码，而是不知道项目里的“暗知识”。

什么是暗知识？比如：

- 这个模块为什么不能直接访问数据库。
- 这个老接口为什么不能改返回字段。
- 测试为什么必须用某个 fake service。
- 某个目录里看起来重复的代码为什么暂时不能合并。
- 团队为什么禁止在业务逻辑里直接读环境变量。

这些信息如果只存在于你的脑子里、聊天记录里、会议里，对 Agent 来说就等于不存在。它只能猜。猜对了你会觉得 AI 很聪明，猜错了你会觉得 AI 不靠谱。

Harness Engineering 的第一条基本功，就是把这些暗知识变成仓库里的明知识。

## 为什么仓库是 AI 的记忆

人类开发者可以通过很多方式获得上下文：问同事、翻聊天记录、回忆上次会议、靠多年经验判断。

AI Agent 的上下文来源更窄。它最稳定、最可复用、最容易被版本控制的记忆，就是仓库里的文件。

所以可以记住这句话：

```text
不在仓库里的东西，对 Agent 来说就不稳定。
```

注意，不是说 Agent 完全不能从聊天中获得信息，而是聊天信息不适合作为长期知识：

- 它不一定会被下一个 session 读取。
- 它不能被测试和 CI 检查。
- 它不容易被多人共同维护。
- 它不能随着代码一起演进。

仓库里的文档、任务、脚本、测试、配置，才是 Agent 最可靠的记忆系统。

## AGENTS.md 是地图，不是百科全书

很多人第一次写 `AGENTS.md`，会想把所有规则都塞进去。结果文件越来越长，Agent 读起来费劲，人也维护不动。

更好的设计是：`AGENTS.md` 做地图。

它应该回答四个问题：

1. 这个项目是什么？
2. 目录怎么走？
3. 做事前应该读哪些文档？
4. 完成前必须跑哪些检查？

一个好的根 `AGENTS.md` 可以这样写：

```markdown
# Agent Guide

## Project

This is a Zola blog and writing workspace.

## Structure

- `content/articles/`: published articles
- `themes/simple-pure/`: local theme
- `config.toml`: site config

## Before editing

- For article changes, follow existing front matter.
- Do not edit `public/`.
- Keep Markdown readable and concise.

## Checks

- Run `zola check`.
- Run `zola build`.
```

这份文件不需要解释 Zola 的全部机制，也不需要记录每篇文章的写作历史。它只负责把 Agent 带到正确位置。

## 子目录也可以有局部地图

当项目变大时，根 `AGENTS.md` 不应该承担所有规则。可以在关键目录里放局部说明。

例如：

```text
AGENTS.md
src/api/AGENTS.md
src/domain/AGENTS.md
tests/AGENTS.md
```

根文件负责总览：

```markdown
- API work: read `src/api/AGENTS.md`
- Domain work: read `src/domain/AGENTS.md`
- Test work: read `tests/AGENTS.md`
```

局部文件负责具体规则：

```markdown
# src/api

- Route handlers only parse HTTP input and call services.
- Do not import repositories here.
- Return API errors through `ApiError`.
```

这种结构叫渐进式披露。Agent 不需要一次读完所有规则，而是在需要的时候进入对应区域。

## 任务文件：把“我要什么”写清楚

很多 AI 编程失败，不是因为模型不会写，而是任务本身太模糊。

比如：

```text
帮我优化一下搜索。
```

这句话有太多解释空间：

- 是优化性能？
- 是优化搜索结果排序？
- 是优化 UI 体验？
- 是修 bug？
- 是支持模糊匹配？

更好的做法是写任务文件。

```markdown
# Task: Improve note search

## Goal

Users can find notes by matching title or body text.

## Requirements

- Search title and body.
- Matching is case-insensitive.
- Empty query returns validation error.
- No results returns an empty list.

## Out of scope

- Do not add ranking.
- Do not change database schema.

## Verification

- Add tests for title match, body match, empty query, no result.
- Run `pytest`.
```

这份文件的作用很大：

- 人类先把需求想清楚。
- Agent 可以反复读取。
- 未来可以回看当时为什么这么做。
- Reviewer 可以按验收标准检查。

任务文件是把一句话需求变成可执行意图。

## 决策日志：记录“为什么”

代码告诉你“现在是什么”，但不一定告诉你“为什么这样”。

AI Agent 很容易看到一个设计后，觉得可以重构掉。可有些设计是为了兼容历史行为、性能限制、部署约束或用户习惯。

所以关键决策要写下来。

不需要复杂 ADR 模板，一个轻量 `docs/decisions.md` 就够：

```markdown
# Decisions

## 2026-05-26: Keep search in application layer

We keep note search in the application layer for now because the dataset is small
and we do not want to introduce database-specific full-text search yet.

Revisit when note count exceeds 50k.
```

这个记录能阻止 Agent 过早引入复杂方案。以后你真的需要数据库全文搜索，也知道什么时候该重新评估。

## 架构文档：写边界，不写废话

架构文档最容易写成空话：

```text
系统采用高内聚低耦合设计，具备良好扩展性。
```

这对 Agent 没有帮助。Agent 需要的是可执行边界。

比如：

```markdown
# Architecture

## Layers

UI -> Service -> Repository -> Database

## Rules

- UI can import Service.
- Service can import Repository.
- Repository can import Database.
- Repository must not import UI.
- UI must not import Database.
```

再加一个例子：

```markdown
Bad:
`src/pages/NotePage.tsx` imports `db.notes`.

Good:
`NotePage.tsx` calls `noteService.listNotes()`.
```

这种文档才是 Harness 的一部分，因为它能被 Agent 读懂，也能被脚本检查。

## 术语表：让命名一致

项目一大，命名很容易漂移。一个地方叫 workspace，一个地方叫 project，一个地方叫 collection。人类还能勉强理解，Agent 会更混乱。

可以准备 `docs/glossary.md`：

```markdown
# Glossary

- Workspace: a top-level user-owned container.
- Project: a collection inside a workspace.
- Note: a user-created text item.
- Entry: do not use; use Note instead.
```

术语表不仅适用于代码，也适用于文档、翻译、产品描述。

如果某个词不能用，直接写出来：

```markdown
Do not use "entry" in code or UI copy. Use "note".
```

## 给 Agent 的命令清单

Agent 最需要确定性的东西之一，是“我该运行什么命令验证”。

不要让它猜。写在 `AGENTS.md`：

```markdown
## Commands

- `npm test`: unit tests
- `npm run lint`: lint checks
- `npm run typecheck`: TypeScript checks
- `npm run dev`: local dev server
```

如果命令有注意事项，也写清楚：

```markdown
- Do not run `npm run format` unless explicitly requested; it rewrites many files.
- `npm test -- --runInBand` is preferred in CI-like environments.
```

这样可以减少误操作。

## 什么不该写进 AGENTS.md

`AGENTS.md` 不是垃圾桶。不要把所有信息都塞进去。

不建议放：

- 大段业务背景故事。
- 过时的路线图。
- 每个文件的逐行解释。
- 临时任务细节。
- 和当前项目无关的通用 AI 技巧。

这些内容会挤占上下文，让真正重要的规则被淹没。

更好的分工：

| 内容 | 放哪里 |
|---|---|
| 项目导航 | `AGENTS.md` |
| 当前任务 | `tasks/*.md` |
| 架构边界 | `docs/architecture.md` |
| 历史原因 | `docs/decisions.md` |
| 术语命名 | `docs/glossary.md` |
| 检查逻辑 | `scripts/check.sh` 或 CI |

## 一个可照抄的目录结构

小项目可以从这个结构开始：

```text
project/
├── AGENTS.md
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   └── glossary.md
├── tasks/
│   └── template.md
├── scripts/
│   └── check.sh
└── src/
```

`tasks/template.md`：

```markdown
# Task: <name>

## Goal

What should be true after this task?

## Requirements

- ...

## Out of scope

- ...

## Verification

- ...
```

这套结构足够轻，但已经能显著提升 AI 的稳定性。

## 常见误区

### 误区一：文档越详细越好

不是。文档应该让 Agent 更快找到关键信息，而不是拖慢它。入口文档短，细节文档分散，才更稳定。

### 误区二：写了 AGENTS.md 就够了

`AGENTS.md` 是前馈引导，不是反馈检查。它告诉 Agent 怎么做，但不能保证 Agent 一定遵守。重要规则还要配测试、lint 或 CI。

### 误区三：任务可以只写在聊天里

聊天适合讨论，任务文件适合执行。复杂任务最好落到仓库文件里。

### 误区四：决策日志太正式，小项目用不上

小项目也会遗忘。只记录关键决策，不需要写成论文。

## 小结

仓库是 AI Agent 最可靠的长期记忆。要让 Agent 稳定工作，就要把隐性知识变成仓库里的显性结构：

```text
AGENTS.md 负责导航。
任务文件负责目标。
架构文档负责边界。
决策日志负责原因。
术语表负责一致性。
检查脚本负责验证。
```

当这些东西存在时，你不需要每次从零解释项目。Agent 可以自己读、自己执行、自己被检查。Harness Engineering 的第一步，就是让仓库变成一个适合 AI 读取和行动的环境。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
