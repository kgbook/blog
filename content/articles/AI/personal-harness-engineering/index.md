+++
title = "个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "个人开发者", "AI 编程", "工程效率"]
+++

OpenAI 的 Harness Engineering 故事很容易让人兴奋：几个人、几个月、上百万行代码、上千个 PR。可是个人开发者看完以后，第一反应往往不是“我也可以”，而是“这和我有什么关系？”

你没有内部版 Codex，没有专职团队，没有完整平台，没有一堆人帮你 review。你可能只有一个项目、一个编辑器、一个 AI 编程工具、有限的时间和预算。

但这不代表 Harness Engineering 只属于大厂。恰恰相反，个人开发者更需要轻量 Harness。因为团队里还有同事兜底，个人项目里只有你自己。AI 生成得越快，你越需要一套方法保证自己不会被代码淹没。

## 个人开发者的问题不是不会用 AI

很多个人开发者已经会用 AI 写代码了。真正的问题是：AI 生成速度上来了，但你的判断、评审、维护能力没有同步扩大。

常见情况是这样的：

```text
第 1 天：AI 帮我做了一个功能，很快。
第 3 天：AI 又做了三个功能，代码开始有点散。
第 7 天：我已经不确定某个文件为什么存在。
第 14 天：我不敢大改，因为不知道会不会牵一发动全身。
```

这不是 AI 不好，而是你把 AI 当成“更快的自己”，却没有给它配套的工程边界。

个人开发者缺的不是更复杂的提示词，而是最小可行 Harness：

- 让 AI 知道项目规则。
- 让错误尽早暴露。
- 让设计决策能被未来的你读懂。
- 让重复提醒变成固定规则。
- 让每次 AI 犯错以后，系统都变得更好一点。

## 大团队经验要降级使用

OpenAI 的原始案例有很多隐含条件：

| 维度 | 大团队条件 | 个人开发者现实 |
|---|---|---|
| 人员 | 多人专职 | 一个人，常常业余时间 |
| 代码库 | 从空仓库开始 | 可能是旧项目或半成品 |
| 评审 | 有团队 review | 主要靠自己 |
| 工具 | 完整 CI 和内部平台 | 可能只有本地命令 |
| 成本 | 可承担长时间运行 | 要控制预算 |
| 并发 | 多 Agent 并行 | 通常一次一个任务 |

所以个人开发者不应该照搬“上千 PR 的高吞吐模式”。你真正要的是：在小项目里建立足够的约束，让 AI 帮你提速，而不是把项目推向失控。

## 哪些概念可以直接用

### 仓库即记录系统

这条对个人开发者最重要。

不要把关键知识只留在聊天记录里。聊天记录很难维护，也不一定会被下一个 Agent session 读取。应该把它写进仓库：

- `AGENTS.md`：项目导航和规则。
- `tasks/`：每个任务的目标和验收标准。
- `docs/decisions.md`：关键决策为什么这么做。
- `docs/architecture.md`：模块边界和依赖方向。

对个人开发者来说，这些文档不是写给别人看的，而是写给三天后的自己和下一次 AI session 看的。

### 地图而非手册

不要写一本巨大的“AI 使用说明书”。一个轻量 `AGENTS.md` 就够开始：

```markdown
# Agent Guide

## Project

This is a personal expense tracker.

## Structure

- `src/ui/`: pages and components
- `src/domain/`: business rules
- `src/storage/`: persistence
- `tests/`: tests

## Rules

- UI must not access storage directly.
- Business rules belong in `src/domain`.
- Every bug fix needs a regression test.

## Checks

- Run `npm test`.
- Run `npm run lint`.
```

它像地图，只告诉 Agent 应该去哪、不能去哪、怎么验证。细节可以以后再补。

### 机械化执行

个人项目也要有测试和 lint。不是为了追求企业级流程，而是为了保护你自己的注意力。

最小组合：

```text
一个测试命令
一个 lint 命令
一个类型检查命令
一个总检查脚本
```

例如：

```bash
npm test
npm run lint
npm run typecheck
```

或者统一成：

```bash
./scripts/check.sh
```

以后你给 AI 的任务可以固定收尾：

```text
实现后运行 ./scripts/check.sh，修复所有失败，再停止。
```

这比每次手动问“你测试了吗”可靠得多。

## 哪些概念需要降级

### 吞吐量不是个人项目的第一目标

大团队关心每天合并多少 PR。个人开发者更应该关心：我是否还理解自己的项目？

AI 可以让你一天生成很多代码，但如果你没有及时读、测、整理，速度越快，债务越高。

个人开发者的目标不是“让 AI 尽可能多写”，而是：

```text
让 AI 写我已经想清楚的部分。
让我保留对项目的设计控制权。
```

### 垃圾回收不用自动化到极致

大团队可以做后台扫描、质量评分、自动重构 PR。个人开发者不用一开始做这么重。

轻量版做法是建立节奏：

- 每完成一个功能，读一遍 AI 改过的核心文件。
- 每周清理一次重复逻辑和临时实现。
- 每次发现坏模式，写进 `AGENTS.md` 的禁止事项。
- 如果同类问题出现三次，再考虑写检查脚本。

这就是个人版熵管理。

### 智能体可读性不是唯一选型标准

OpenAI 强调选择“无聊技术”，因为 Agent 更容易处理常见技术栈。

个人开发者也应该参考这个原则，但不要绝对化。如果你的项目确实需要 Rust、C++、嵌入式、Android 系统开发，就不要为了 AI 友好强行换栈。

更务实的原则是：

```text
技术栈可以按项目需要选。
写法尽量清晰、常见、可搜索、可测试。
```

在一个复杂技术栈里，也可以写出 Agent 友好的代码。

## 一个人的最小 Harness

可以把个人 Harness 分成三级。

### 第一级：能工作

适合刚开始使用 AI 编程的人。

需要：

- `AGENTS.md`
- 一个任务模板
- 一个检查命令
- 核心功能测试

任务模板示例：

```markdown
# Task

## Goal

实现什么功能。

## Requirements

- 必须满足的行为。
- 不允许破坏的旧行为。
- 需要兼容的边界情况。

## Verification

- 需要新增哪些测试。
- 需要运行哪个命令。
```

### 第二级：能维护

适合项目开始变大以后。

增加：

- `docs/architecture.md`
- `docs/decisions.md`
- 代码分层规则
- 禁止事项清单
- 重构任务列表

这一级的重点是保持心智模型。你要能回答：

- 这个模块负责什么？
- 为什么这么设计？
- 哪些地方不能乱改？
- AI 如果要改，应该先读哪份文档？

### 第三级：能扩展

适合你开始频繁让 AI 处理复杂任务。

增加：

- 自定义 lint 或脚本。
- Reviewer Agent 提示词。
- 长任务 scratchpad。
- 明确完成信号。
- CI 检查。

这时你已经不是“让 AI 写代码”，而是在搭一个小型执行系统。

## 推荐工作流

### 1. 先写任务，不先聊天

不要一上来就对 AI 说“帮我做一个功能”。先写任务文件：

```text
tasks/add-export-csv.md
```

里面写清目标、边界、测试。然后让 AI 读取任务文件实现。

好处是任务可以被版本化，也可以被你反复修改。

### 2. 让 AI 先复述计划

对稍复杂的任务，先让 AI 输出计划，不立刻改代码：

```text
Read AGENTS.md and tasks/add-export-csv.md.
Summarize the implementation plan before editing files.
```

你确认方向没错，再让它执行。这样能提前发现需求理解偏差。

### 3. 每次只给一个清晰目标

不要一次让 AI “重构项目、加功能、修 bug、优化性能”。任务越大，越容易失控。

更好的拆法：

```text
任务 1：补测试
任务 2：重构模块边界
任务 3：新增功能
任务 4：清理命名和文档
```

### 4. 让检查成为结束条件

完成条件不要写“你觉得完成了就结束”。应该写：

```text
When all tests and lint checks pass, summarize the changes.
```

对于重要任务，可以再加：

```text
Do not stop after writing code. Run verification and fix failures.
```

### 5. 人类做最终设计审查

测试通过以后，你仍然要看几个关键点：

- 抽象是不是过度？
- 接口是不是好用？
- 数据模型有没有埋坑？
- 错误处理是否符合产品预期？
- 新代码是否让旧代码更难理解？

AI 可以帮你写，也可以帮你审，但最终判断仍然在你。

## 一个真实用法示例

假设你要给一个个人记账应用加“导出 CSV”功能。

不要这样开始：

```text
帮我加一个 CSV 导出。
```

更好的做法：

第一步，写 `tasks/export-csv.md`：

```markdown
# Export CSV

## Goal

Users can export all expenses as a CSV file.

## Requirements

- Include date, category, amount, note.
- Preserve current filters when exporting from filtered view.
- Use UTF-8.
- Empty result exports a header-only CSV.

## Verification

- Unit test CSV formatting.
- Test empty result.
- Test filtered export.
- Run `npm test`.
```

第二步，让 AI 执行：

```text
Read AGENTS.md and tasks/export-csv.md.
Implement this feature.
Keep business logic out of UI components.
Run npm test and fix failures.
```

第三步，人类审查：

- CSV 字段是否符合预期？
- 是否把格式化逻辑放到了 domain 层？
- 是否影响现有筛选逻辑？
- 文件名和编码是否合理？

整个过程并不复杂，但它比“随口一问”稳定得多。

## 常见误区

### 误区一：我只是个人项目，不用写规则

个人项目更容易丢失上下文。你今天知道为什么这么写，不代表下周还记得。规则不是给公司看的，是给未来的自己和 AI 看的。

### 误区二：AI 写得快，所以我不用读代码

这是最危险的想法。你可以少写，但不能不理解。否则你会从开发者变成一个不懂项目的审批人。

### 误区三：测试通过就可以放心合并

测试覆盖的是你想到的行为，不覆盖你的设计判断。个人开发者尤其要检查架构和产品语义。

### 误区四：Harness 要一步到位

不需要。最好的 Harness 是随着错误长出来的。先从 `AGENTS.md` 和检查命令开始，遇到问题再加规则。

## 小结

个人开发者使用 Harness Engineering 的关键，不是复制大厂流程，而是建立轻量约束：

```text
写清项目规则。
写清任务目标。
自动暴露错误。
保留设计判断。
持续清理熵。
```

AI 是力量倍增器。它倍增的不只是你的效率，也会倍增你的混乱。Harness Engineering 的作用，就是让它更多倍增你的判断力，而不是倍增你的技术债。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
