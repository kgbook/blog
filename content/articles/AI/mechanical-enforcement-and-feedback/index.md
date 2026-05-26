+++
title = "别反复提醒 AI：用测试、Lint 和反馈回路让它自己修"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "测试", "Lint", "反馈回路"]
+++

如果你使用 AI 编程一段时间，很可能说过这些话：

```text
不要直接访问数据库。
记得写测试。
不要改公共接口。
这个文件太大了，拆一下。
上次不是说过了吗？
```

问题是，只靠反复提醒并不可靠。AI Agent 可能这次记住，下次忘记；这个 session 记住，另一个 session 又忘记。

Harness Engineering 的做法是：不要只提醒，要把提醒变成可执行检查。

这篇文章讲的就是 Mechanical Enforcement：机械化执行。它的核心思想很简单：

```text
重要规则不要只写在文档里，要让机器能检查。
```

## 软约束和硬约束

先区分两种约束。

软约束是提醒：

```markdown
请保持代码整洁。
请遵守分层架构。
请不要写太大的文件。
```

硬约束是检查：

```text
测试失败，不能结束。
lint 失败，不能合并。
类型检查失败，不能提交。
API 层 import repository，脚本报错。
```

软约束有用，但不够。它像路牌，告诉 Agent 应该往哪里走。硬约束像护栏，真的越界时会拦下来。

好的 Harness 需要两者结合：

```text
AGENTS.md / docs = 前馈引导
tests / lint / CI = 反馈传感器
```

前馈让 Agent 少犯错，反馈让 Agent 犯错后能修。

## 为什么“文档提醒”会失效

文档提醒有几个天然问题：

- Agent 不一定读取到。
- 读取到了也可能被长上下文稀释。
- 规则太抽象时，Agent 不知道怎么执行。
- 规则过期时，人类也很难发现。

比如文档写：

```text
保持良好的模块边界。
```

这句话对人类都不够清楚，对 Agent 更难。什么叫良好？哪些 import 不允许？违反后怎么改？

更好的表达是：

```text
API layer may import service layer.
API layer must not import repository layer.
```

更进一步，把它写成检查：

```text
Error: src/api/notes.ts imports src/repository/notes.ts.
Fix: API handlers should call noteService instead of repository functions.
```

这时规则才真正进入 Harness。

## Lint 错误信息要像修复指令

传统 lint 错误通常只告诉你错了：

```text
no-console: Unexpected console statement.
```

面向 Agent 的错误信息应该告诉它怎么修：

```text
Error: Raw console.log is not allowed in service code.
Fix: Use logger.info({ event, fields }) from src/platform/logger.
Reason: structured logs are required for production debugging.
```

这不是为了啰嗦，而是为了让 Agent 能自我修正。

一个好的错误信息包含三部分：

1. 错在哪里。
2. 为什么错。
3. 应该怎么改。

再看一个架构例子：

```text
Error: UI component imports database module.
File: src/ui/NoteList.tsx
Fix: Move data access to src/service/noteService.ts and call it from the UI.
Rule: UI -> Service -> Repository -> Database.
```

这样的错误信息就是反馈回路的一部分。

## 最小检查组合

技术小白不用一开始写复杂工具。先准备四类检查。

### 1. 格式检查

保证代码风格统一。

常见工具：

- JavaScript/TypeScript：Prettier
- Python：ruff format 或 black
- Go：gofmt
- Rust：cargo fmt

### 2. Lint

检查常见坏味道。

常见工具：

- JavaScript/TypeScript：ESLint
- Python：ruff
- Go：go vet
- Rust：clippy

### 3. 类型检查

类型系统是最便宜的传感器之一。

常见命令：

```bash
tsc --noEmit
mypy .
cargo check
go test ./...
```

### 4. 测试

测试验证行为。最小项目也应该有核心测试。

```bash
pytest
npm test
cargo test
go test ./...
```

最后统一成一个脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run typecheck
npm test
```

以后让 Agent 运行：

```text
Run ./scripts/check.sh and fix all failures.
```

## 自定义检查：把团队规则变成脚本

通用 lint 检查不了所有项目规则。Harness Engineering 的关键，是把你的项目不变量也写成检查。

例如你有一个分层规则：

```text
src/api 不允许 import src/repository
```

可以写一个简单脚本扫描 import。即使脚本很朴素，也比纯文档强。

伪代码：

```text
for each file in src/api:
  if file contains "src/repository":
    print actionable error
    exit 1
```

检查不一定要复杂。重要的是它能稳定失败，并给出修复方向。

这个学习仓库里的 `scripts/check-consistency.sh` 就是类似思路。它不是检查业务逻辑，而是检查文档数量声明是否漂移：文章数、翻译数、README badge、引用索引都要一致。

对人来说，这是烦人的维护细节。对脚本来说，这是最适合机械化的工作。

## 反馈飞轮

机械化执行不是一次性工作，而是一个飞轮：

```text
观察失败 -> 诊断根因 -> 沉淀规则 -> 自动检查 -> 下次更早失败
```

举个例子：

第一次，AI 在 API 层直接写 SQL。你手动指出。

第二次，AI 又这么做。你把规则写进 `AGENTS.md`。

第三次，AI 还是这么做。你写一个脚本检查 API 层 import。

第四次，脚本失败，AI 根据错误信息自己修。

这就是飞轮转起来了。你不再无限重复提醒，而是把提醒变成系统能力。

## 测试不等于正确性

这里必须强调一个边界：测试很重要，但测试通过不代表一切正确。

测试能发现：

- 语法错误
- 类型错误
- 已知场景的行为错误
- 回归问题

测试不一定能发现：

- 需求理解错了
- 产品方向错了
- 抽象设计错了
- 用户体验不好
- 安全边界设计不合理

所以 Harness 里的检查分三层：

| 层次 | 例子 | 成熟度 |
|---|---|---|
| 可维护性 | lint、类型、格式、文件大小 | 高 |
| 架构适应度 | 依赖方向、模块边界、约束规则 | 中 |
| 行为正确性 | 业务需求、用户体验、安全语义 | 低 |

前两层适合机械化，第三层仍然需要人类判断和高质量验收标准。

## Reviewer Agent 有用，但不能替代人

一种常见做法是让另一个 Agent 做 review：

```text
Review the diff against AGENTS.md and the task requirements.
Focus on bugs, missing tests, architecture violations, and edge cases.
```

这很有用，因为 Reviewer 用新的上下文看问题，可能发现 Builder 忽略的东西。

但它不是最终答案。Reviewer Agent 也可能过度称赞，也可能漏掉需求误解。

更稳妥的方式是：

```text
自动检查负责确定性问题。
Reviewer Agent 负责第一轮语义审查。
人类负责最终产品和设计判断。
```

## 一个具体场景：禁止跨层调用

假设项目规定：

```text
UI -> Service -> Repository -> Database
```

坏代码：

```ts
// src/ui/NotePage.tsx
import { noteRepository } from "../repository/noteRepository";
```

第一次发现时，你可以告诉 AI：

```text
UI should not import repository directly.
```

但这只是提醒。

更好的做法是补三样东西。

第一，`docs/architecture.md` 写清规则：

```markdown
UI may import Service.
UI must not import Repository.
```

第二，`AGENTS.md` 指向架构文档：

```markdown
For UI changes, follow `docs/architecture.md`.
```

第三，`scripts/check-architecture.sh` 检查：

```text
Error: UI layer imports repository layer.
Fix: Move data access behind service functions.
```

以后 Agent 再犯，脚本会拦住。

## 如何决定什么规则值得机械化

不是所有偏好都值得写成检查。

适合机械化的规则通常满足：

- 经常出错。
- 影响质量或稳定性。
- 判断标准明确。
- 修复路径相对固定。

适合：

```text
API 层不能 import Repository。
所有导出的函数必须有测试。
文件不能超过 500 行。
禁止裸 console.log。
```

不适合：

```text
代码要优雅。
设计要合理。
命名要有品味。
```

后者可以写进 review checklist，但不适合直接做脚本。

## 小白落地步骤

如果你今天要开始做，可以按这个顺序：

1. 把现有测试命令写进 `AGENTS.md`。
2. 新增 `scripts/check.sh`，串起 lint、typecheck、test。
3. 每次让 AI 完成任务，都要求运行检查。
4. 记录 AI 重复犯的前三类错误。
5. 把最高频的一类错误写成自定义检查。
6. 把检查错误信息写成可执行修复指令。

不需要一次性把所有规则自动化。Harness 是长出来的，不是设计一下午就完成的。

## 常见误区

### 误区一：有了 AGENTS.md 就不需要 lint

`AGENTS.md` 是引导，不是强制。重要规则要有检查。

### 误区二：所有规则都要自动化

自动化有成本。先自动化高频、明确、影响大的规则。

### 误区三：AI 会自己知道怎么修

不一定。错误信息越具体，自我修复越稳定。

### 误区四：测试能解决所有问题

测试是必要条件，不是充分条件。行为正确性仍然需要人类验收。

## 小结

不要把同一句提醒说十遍。说到第三遍，就应该考虑把它变成 Harness 的一部分。

```text
文档负责告诉 AI 怎么走。
测试和 lint 负责告诉 AI 哪里错。
错误信息负责告诉 AI 怎么修。
人类负责判断方向对不对。
```

这就是机械化执行的价值。它不是为了让流程变重，而是为了把你的注意力从重复提醒里解放出来。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
