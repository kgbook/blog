+++
title = "Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "Codex", "工程效率", "软件工程"]
+++

大模型已经很会写代码了，但很多人真正用起来以后，会遇到一个尴尬问题：它能很快生成一大堆东西，却不一定稳定、可维护、符合项目约定。

第一次看起来很惊艳，第二次开始出现风格漂移，第三次改坏旧逻辑，第四次你发现自己在给 AI 生成的代码擦屁股。于是效率提升没有想象中那么大，甚至把问题从“我写代码慢”变成了“我审 AI 代码很累”。

Harness Engineering 要解决的就是这个问题。

它不是一个新框架，也不是某个 IDE 插件，而是一种使用 AI Agent 的工程方法：人不再把主要精力放在一行行写代码上，而是设计环境、规则、工具和反馈回路，让 AI Agent 在清晰边界内稳定工作。

一句话概括：

```text
传统开发：人写代码，机器执行代码。
Harness Engineering：人设计约束和反馈，AI 写代码，机器和工具验证结果。
```

这里的 Harness 可以理解成“驭缰”或“控制系统”。马有力气，但需要缰绳、路线、障碍物和骑手的判断。AI Agent 也一样：模型很强，但它需要项目上下文、工具权限、质量门禁和持续反馈。

## 项目背景

Harness Engineering 这个说法来自 OpenAI 2026 年 2 月发布的文章《Harness Engineering: Harnessing Codex in an Agent-First World》。文章里提到，一个小团队用 Codex 从空仓库开始，在 5 个月内生成了约 100 万行代码、合并约 1500 个 PR，团队从 3 人扩展到 7 人后，人均每天仍能合并约 3.5 个 PR。

这个故事容易让人误解成“AI 已经可以完全替代程序员写代码”。但更关键的点不是“AI 写了多少代码”，而是这支团队没有把 AI 当成一个聊天框来用。他们围绕 AI 建了一套工程系统：

- 项目知识写进仓库，而不是散落在聊天记录和人的脑子里。
- 用 `AGENTS.md` 给 Agent 导航，而不是每次重新解释项目。
- 用 linter、测试和 CI 强制执行架构规则。
- 让 Agent 在失败反馈中自我修正。
- 人类负责设计环境、拆任务和验收方向，Agent 负责执行。

我当前的 `harness-engineering` 学习仓库，也是围绕这条路线整理的：有概念笔记、独立思考、Ralph Demo 实践、翻译流水线复盘和一致性检查脚本。这个仓库本身就是一个小型 Harness 样板：

- 根目录 `AGENTS.md` 告诉智能体仓库结构和学习路线。
- `concepts/` 拆解核心概念。
- `practice/01-ralph-demo/` 记录一个完整 Agent 编排实验。
- `feedback/` 记录实践中的问题和修正。
- `scripts/check-consistency.sh` 机械检查 README、引用数量、翻译数量是否漂移。

也就是说，Harness Engineering 不是停留在理论上。它可以从一个人的 Markdown 仓库开始落地。

## 它到底解决什么问题

很多人使用 AI 编程的第一阶段是“提示词驱动”：

```text
帮我写一个登录接口。
帮我改一下这个 bug。
帮我重构这个文件。
```

这种方式适合小任务，但一旦进入真实项目，就会暴露几个问题。

第一，AI 看不到隐性知识。

团队约定、架构边界、历史决策、踩坑经验，如果只存在于 Slack、飞书、会议纪要或某个人脑子里，对 Agent 来说就等于不存在。它只能根据当前上下文和训练经验猜。

第二，AI 会模仿代码库里的坏味道。

如果仓库里已经有重复逻辑、混乱分层、随手 `console.log`、随意命名，Agent 会把这些当成“本项目风格”继续复制。代码库里的熵会被 AI 放大。

第三，AI 生成速度越快，评审压力越大。

AI 让编码吞吐量上去了，但测试、评审、集成、产品验收没有同步升级，瓶颈就会转移到人身上。你不是更轻松，而是更忙着判断一大堆代码能不能合。

第四，文档提醒不可靠。

你可以在 README 里写“不要跨层调用数据库”，但 AI 不一定每次都读，也不一定严格遵守。真正可靠的是能自动失败的规则：测试失败、lint 失败、类型检查失败、CI 失败。

Harness Engineering 的核心目标，就是把这些不稳定因素收进一个可管理的系统里：

```text
隐性知识 → 版本化文档
口头约定 → 可执行检查
一次性提示 → 可复用规则
人工盯梢 → 自动反馈回路
随机生成 → 受控交付
```

## 技术原理：Agent = Model + Harness

理解 Harness Engineering，先要把“模型”和“智能体”分开。

裸模型只会接收输入并生成输出。它本身不会自动知道你的项目结构，不会自己跑测试，不会稳定保存任务状态，也不会天然理解你的团队规范。

当你给它加上这些东西时，它才变成一个可工作的 Agent：

- 系统提示词和 `AGENTS.md`
- 文件读取、搜索、编辑工具
- 终端执行能力
- 沙箱环境
- 测试、lint、类型检查
- 任务拆解和循环执行逻辑
- 中间状态记录
- 失败后的重试和修正机制

所以可以把公式写成：

```text
Agent = Model + Harness
Harness = 模型之外的一切上下文、工具、约束和反馈回路
```

这背后有一个非常朴素的工程思想：不要试图通过“更长的提示词”解决所有问题，而要把规则沉淀到环境里。

提示词是软约束，工具和检查是硬约束。

例如你不希望 Agent 写出超过 500 行的大文件。只在 `AGENTS.md` 里写一句“文件不要太长”是不够的。更好的做法是：

1. 在 `AGENTS.md` 里说明项目希望小文件、清晰分层。
2. 在架构文档里说明如何拆分模块。
3. 写一个检查脚本，发现超过 500 行就失败。
4. 错误信息里直接告诉 Agent 怎么修。

普通错误信息可能是：

```text
Error: File exceeds 500 lines.
```

面向 Agent 的错误信息应该是：

```text
Error: File exceeds 500 lines.
Fix: Split this file into domain-specific modules.
Move shared types to <domain>/types, business logic to <domain>/service,
and keep UI code in <domain>/ui. See docs/architecture.md.
```

这就形成了反馈回路：Agent 生成代码，检查脚本失败，失败信息给出修复路径，Agent 再修改。人不需要每次手动提醒同一件事。

## 六个核心概念

### 1. 仓库是唯一记录系统

Harness Engineering 的第一条原则是：不在仓库里的东西，对 Agent 来说就不存在。

不要指望 Agent 记得你昨天在聊天里说过什么，也不要指望它理解某个同事脑子里的历史原因。真正可靠的做法是把重要信息写进仓库：

- 项目结构
- 架构约束
- 命名规范
- 常用命令
- 测试方式
- 禁止事项
- 关键设计决策
- 术语表

这不是为了写文档而写文档，而是给 Agent 提供可读取、可版本化、可复用的上下文。

一个简单的 `AGENTS.md` 可以长这样：

```markdown
# Project Guide

## Structure

- `src/api/`: HTTP routes
- `src/domain/`: business logic
- `src/db/`: database access
- `tests/`: automated tests

## Rules

- API layer must not query database directly.
- Domain layer must not import UI code.
- Every bug fix needs a regression test.
- Run `npm test` before finishing.

## Commands

- `npm test`: run unit tests
- `npm run lint`: run lint checks
- `npm run typecheck`: run TypeScript checks
```

重点不是写得长，而是写得准。`AGENTS.md` 应该像地图，不应该像百科全书。入口文件给方向，细节再链接到更深的文档。

### 2. 地图，而不是说明书

很多人一开始会犯一个错误：把所有规则都塞进一个巨大的提示文件。结果文件越来越长，Agent 读不完，人也维护不动。

更好的方式是渐进式披露。

根目录 `AGENTS.md` 只告诉 Agent：

- 当前仓库是什么。
- 有哪些目录。
- 做某类任务应该读哪个文件。
- 必须跑哪些检查。

然后在子目录放更具体的 `AGENTS.md`。例如：

```text
AGENTS.md
src/api/AGENTS.md
src/domain/AGENTS.md
docs/architecture.md
docs/testing.md
```

这样 Agent 做 API 任务时，先读根说明，再进入 `src/api/` 看局部规则。它不需要一开始就吞下整个世界。

### 3. 机械化执行

文档会过期，规则会被忘记，但自动检查每次都会跑。

所以 Harness Engineering 很强调 Mechanical Enforcement，也就是把重要约束变成机器能检查的东西。

常见检查包括：

- 单元测试
- 集成测试
- 类型检查
- lint
- 格式化检查
- 依赖方向检查
- 文件大小检查
- 架构分层检查
- 文档一致性检查

我这个学习仓库里的 `scripts/check-consistency.sh` 就是一个很小但很典型的例子。它检查：

- `references/articles.md` 的文章编号是否连续。
- README badge 里的文章数量是否同步。
- `concepts/`、`thinking/`、`feedback/` 实际文件数是否和 README 声明一致。
- 翻译文章数量是否和多个地方的声明一致。

这些问题靠人肉维护很容易漂移，但脚本可以每次提交前检查。对 Agent 来说，这种脚本尤其有价值：它不只是告诉 Agent “错了”，还把错在哪里暴露出来。

### 4. 为 Agent 可读性优化

以前我们常说代码要“人类可读”。现在还要补一句：代码也要“Agent 可读”。

Agent 更擅长处理训练集中大量出现、结构稳定、约定清楚的技术和模式。越是冷门、魔法、隐式、动态、黑盒，Agent 越容易猜错。

这不代表只能用无聊技术，而是说：在没有强理由时，优先选择清晰、稳定、常见的写法。

比如：

- 明确的目录结构比“全靠约定”的结构更好。
- 强类型比到处传 `any` 更好。
- 小函数、小文件比千行大文件更好。
- 明确命名比缩写和隐喻更好。
- 可本地启动的服务比依赖一堆手工环境更好。

如果一个项目人类读起来都费劲，Agent 只会更费劲。

### 5. 背压，而不是微操

Harness Engineering 不是把 Agent 变成只会照步骤执行的脚本。相反，好的 Harness 应该给目标、给边界、给反馈，而不是规定每一步怎么走。

例如你不需要这样写：

```text
第一步创建 user.ts。
第二步写 getUser 函数。
第三步创建 user.test.ts。
第四步运行 npm test。
```

更好的写法是：

```text
实现用户查询接口。
要求：
- API 层不能直接访问数据库。
- 业务逻辑放在 domain 层。
- 必须包含成功、用户不存在、数据库错误三个测试。
- `npm test` 和 `npm run lint` 必须通过。
```

这叫 Backpressure over Prescription：不规定实现路径，但用检查和验收标准拒绝坏结果。

这样既保留了模型的推理能力，又不会让它越界。

### 6. 熵管理

AI 生成代码的速度越快，代码库变乱的速度也可能越快。

如果没有熵管理，项目会经历这样的过程：

1. 第一次生成很快，很爽。
2. 第二次复用了一些不太好的模式。
3. 第三次坏模式扩散到更多文件。
4. 第四次人已经不敢改了。

所以 Harness Engineering 不只是“让 AI 写”，还要“持续清理 AI 写出来的东西”。

最简单的做法是建立节奏：

- 每完成一个功能，要求 Agent 自查是否有重复逻辑。
- 每次发现同类问题，更新 `AGENTS.md` 或新增检查。
- 每周做一次小重构，而不是等技术债爆炸。
- 把坏模式加入禁止清单。

这和垃圾回收很像。不是一次清干净，而是持续回收。

## 一个最小可行 Harness

如果你是技术小白，或者只是个人项目，不需要一开始就搞复杂的多 Agent 编排。可以从最小可行版本开始。

### 第一步：写一个短的 AGENTS.md

控制在 50 到 100 行以内，写清楚四件事：

- 项目是做什么的。
- 目录怎么组织。
- 常用命令是什么。
- 哪些事情不能做。

示例：

```markdown
# Agent Guide

This is a small FastAPI project for managing personal notes.

## Structure

- `app/api/`: HTTP routes
- `app/service/`: business logic
- `app/repository/`: database access
- `tests/`: pytest tests

## Rules

- API routes must call service functions, not repository functions directly.
- Repository functions must not contain HTTP logic.
- Every new endpoint needs tests.
- Do not change database schema without updating migrations.

## Verification

- Run `pytest`.
- Run `ruff check .`.
```

### 第二步：把验收标准写进任务文件

不要只在聊天框里说“帮我做一个功能”。更好的方式是在仓库里创建任务说明，例如 `tasks/add-note-search.md`：

```markdown
# Task: Add note search

## Goal

Users can search notes by title and body keyword.

## Requirements

- Add `GET /notes/search?q=...`.
- Search title and body.
- Return empty list when no result is found.
- Do not expose database errors to users.

## Tests

- search by title
- search by body
- no result
- missing query parameter
```

这样做有两个好处：

第一，任务本身进入了版本控制，后续可以追溯。

第二，Agent 不需要靠聊天记忆工作，它可以反复读取任务文件。

### 第三步：准备基础检查

最小检查组合通常是：

```text
格式化 + lint + 类型检查 + 单元测试
```

不同技术栈可以对应不同命令：

```text
Python: ruff + mypy + pytest
TypeScript: eslint + tsc + vitest
Go: gofmt + go vet + go test
Rust: cargo fmt + cargo clippy + cargo test
```

不要一开始追求完美覆盖率。先保证核心路径有测试，常见错误能被自动发现。

### 第四步：让错误信息可操作

很多检查只告诉你“失败了”，但没有告诉 Agent 怎么修。你可以在自定义脚本里把错误信息写得更像修复指南。

例如检查 API 层不能直接访问数据库：

```text
Error: app/api/notes.py imports app.repository directly.
Fix: API routes should call app.service.note_service.
Move database access into repository and business logic into service.
```

这类错误信息对人有用，对 Agent 更有用。

### 第五步：把重复提醒沉淀成规则

如果你发现自己第三次对 AI 说“不要直接改数据库”，就不要第四次继续说了。

应该把它写进：

- `AGENTS.md`
- 架构文档
- lint 规则
- 测试
- PR checklist

Harness Engineering 的效率来自复利：每次修正都不只是修当前问题，而是让以后同类问题更少发生。

## 具体场景一：让 AI 写一个后端接口

假设你有一个笔记应用，要新增搜索接口。

没有 Harness 的使用方式通常是：

```text
帮我写一个搜索接口。
```

AI 可能直接在 route 里写 SQL，可能忘记测试，可能返回格式和旧接口不一致。

有 Harness 的方式是：

1. `AGENTS.md` 已经写明分层规则。
2. `tasks/add-note-search.md` 写明功能和测试要求。
3. 项目有 `pytest` 和 lint。
4. 自定义检查禁止 API 层直接 import repository。

你给 Agent 的指令可以变成：

```text
Read AGENTS.md and tasks/add-note-search.md.
Implement the task.
Run pytest and ruff.
Fix all failures before stopping.
```

Agent 的执行空间被缩小了，但不是被写死了。它可以自己决定怎么实现搜索，但结果必须满足结构、测试和 lint。

这就是 Harness 的价值：让 AI 的自由发生在正确边界内。

## 具体场景二：让 AI 批量翻译技术文章

Harness Engineering 不只适用于代码。我的学习仓库里有一个“翻译即 Harness”的实践：两周内翻译 11 篇技术文章，其中包括学术论文。

纯人工翻译太慢，纯 AI 翻译又容易出现术语不一致、欧化表达、上下文丢失。解决方案不是反复提醒 AI“翻译好一点”，而是给翻译任务建立 Harness。

这个 Harness 包括：

- 目标语言：简体中文。
- 受众：技术读者。
- 风格：准确、自然、避免直译腔。
- 术语表：例如 Harness 保留英文，Feedforward 译为前馈。
- 分块策略：长文拆成多个 chunk。
- 五轮流水线：分析、提示组装、初稿、批判、修订。
- 中间产物持久化：每一轮都保存文件。

对应到 Harness Engineering：

```text
术语表 = linter
五轮流水线 = feedback loop
分块翻译 = 多 Agent 分治
中间文件 = 仓库即记录系统
```

最终效果是，多个独立 chunk 合并后术语仍然一致，主要清理工作集中在格式问题，而不是全文返工。

这说明 Harness Engineering 的本质不是“AI 写代码”，而是“让 AI 在可验证约束下完成复杂任务”。

## 具体场景三：Ralph 循环

Ralph Orchestrator 是一个更接近 Agent 编排的实践。我的实验任务很小：让 Agent 从零写一个 Python 命令行词频统计工具。

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

Ralph 自动跑了 4 轮：

- Planner：拆任务。
- Builder：写测试和实现。
- Critic：重新跑测试并手动验证 CLI 路径。
- Finalizer：确认完成并输出结束信号。

整个过程耗时 321 秒，费用约 0.31 美元，最后生成了实现、测试和 scratchpad。

这个例子很小，但它展示了 Harness 的关键结构：

- `PROMPT.md` 是任务入口。
- Planner、Builder、Critic、Finalizer 是角色分离。
- pytest 是背压门控。
- scratchpad 是跨轮记忆。
- `LOOP_COMPLETE` 是明确退出条件。

如果没有这些结构，AI 可能写完代码就自称完成。但有了 Harness，它必须经过测试、复核和完成信号。

## 常见误区

### 误区一：Harness Engineering 等于写更好的提示词

提示词很重要，但它只是 Harness 的一部分。

真正的 Harness 还包括文件结构、工具、测试、lint、CI、状态记录、权限边界和反馈机制。只优化提示词，相当于只靠口头管理。

### 误区二：规则越多越好

不是。

规则太少，AI 会乱跑。规则太多，AI 会被淹没，也会让维护成本爆炸。

好的规则应该满足三个条件：

- 高频出错。
- 影响质量。
- 能被检查或明确判断。

比如“代码要优雅”不是好规则；“API 层不能直接访问 repository”是好规则。

### 误区三：测试通过就代表正确

测试只能证明你想到的情况没错，不能证明需求理解正确。

AI 最容易出问题的地方往往不是语法，而是需求误解、边界遗漏、设计方向错误。所以人类仍然要负责判断：

- 这个功能是不是用户真正需要的？
- 抽象是否过度？
- 接口是否稳定？
- 数据模型是否合理？
- 安全边界是否清楚？

Harness Engineering 不是让人退出开发，而是让人从低层重复劳动中上移到判断、设计和验收。

### 误区四：个人项目不需要 Harness

个人项目更需要轻量 Harness。

团队里还有同事 review，个人项目只有你自己。三天后再打开项目，你也会忘记当时的设计。把上下文写进仓库，其实是在帮助未来的自己。

个人开发者不需要一开始就做复杂编排，但至少应该有：

- `AGENTS.md`
- 测试
- lint
- 任务文件
- 简单决策记录

## 一套可以直接照抄的落地清单

如果你想今天就开始，可以按下面的顺序做。

第一天，只做三件事：

1. 新增 `AGENTS.md`，写清楚项目结构、命令和禁止事项。
2. 给当前最重要的功能补 3 到 5 个测试。
3. 把常用验证命令写成一个脚本，例如 `scripts/check.sh`。

第二阶段，开始沉淀规则：

1. 每次 AI 犯重复错误，就更新 `AGENTS.md`。
2. 如果错误能自动检查，就写脚本或 lint。
3. 如果错误来自需求不清，就改任务模板。
4. 如果错误来自架构混乱，就补一页架构文档。

第三阶段，再考虑编排：

1. 把复杂任务拆成 Planner、Builder、Reviewer。
2. 让 Reviewer 用全新上下文检查结果。
3. 引入明确完成信号，例如 `TASK_COMPLETE`。
4. 对长任务保存 scratchpad 或 progress log。

最重要的是，不要一开始追求“全自动开发”。先追求“每次 AI 出错后，系统都变得更好一点”。

## 一个判断标准

怎么知道你的 Harness 有没有效果？

看三个指标：

第一，同类错误是否减少。

如果你还在反复提醒 AI 同一件事，说明规则没有沉淀。

第二，任务交接是否变简单。

如果新开一个 Agent session，它读完仓库文件就能继续工作，说明上下文组织有效。

第三，失败是否能自动暴露。

如果坏结果只能靠你肉眼发现，说明反馈传感器还不够。

一个好的 Harness，不一定让 AI 一次成功，但应该让 AI 失败得更早、更清楚、更容易修。

## 总结

Harness Engineering 的核心不是“让 AI 替你写更多代码”，而是“让 AI 在一个可控、可验证、可迭代的工程环境里工作”。

对技术小白来说，可以把它理解成四句话：

```text
把知识写进仓库。
把规则变成检查。
把任务写清楚。
把失败变成反馈。
```

当你做到这四点，AI 就不再只是一个会写代码的聊天助手，而会逐渐变成一个能在项目里稳定工作的执行者。

人类的角色也会变化：少写重复代码，多设计边界；少反复提醒，多建设规则；少盯每一步，多验收结果。

这就是 Harness Engineering 真正提高效率的地方。

## 延伸阅读

- [OpenAI: Harness Engineering: Harnessing Codex in an Agent-First World](https://openai.com/zh-Hans-CN/index/harness-engineering/)
- 本文参考的学习仓库：`harness-engineering`

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
