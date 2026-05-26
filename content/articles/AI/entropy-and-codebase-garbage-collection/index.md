+++
title = "AI 写得越快，代码越容易乱：Harness Engineering 的熵管理"
date = 2026-05-26

[taxonomies]
categories = ["AI"]
tags = ["Harness Engineering", "AI Agent", "技术债", "重构", "代码质量"]
+++

AI 编程最容易让人上头的地方，是速度。

一个功能，几分钟生成。一个测试文件，几十秒写完。一个页面，描述一下就出来。你会很自然地想：既然这么快，那就多做点。

但软件工程里有一个老问题不会因为 AI 消失：熵。

代码库的熵，就是系统从清晰走向混乱的趋势。AI 让代码生成速度变快，也可能让熵增长速度变快。如果没有管理，项目会从“AI 帮我提效”变成“AI 帮我制造了一堆我不敢改的代码”。

这篇文章讲 Harness Engineering 里的熵管理：如何让 AI 快速产出，同时不把代码库推向失控。

## AI 为什么会放大坏模式

AI Agent 会从当前代码库中学习“本项目风格”。这既是优点，也是风险。

如果项目里有好模式：

- 清晰分层
- 命名一致
- 测试完整
- 文件短小
- 错误处理统一

AI 往往会模仿这些好模式。

但如果项目里有坏模式：

- 复制粘贴逻辑
- 千行大文件
- UI 直接访问数据库
- 到处散落的临时 hack
- 不一致的命名

AI 也会把它们当成“已有惯例”继续复制。

这就是 AI 时代技术债更危险的原因：坏模式不只是留在那里，它会被更快复制。

## 熵增长的典型过程

一个没有 Harness 的项目，经常这样变乱：

第一阶段，快速生成。

```text
这个功能先做出来，后面再整理。
```

第二阶段，局部绕路。

```text
这个地方直接调用一下 repository，反正能跑。
```

第三阶段，模式扩散。

```text
AI 看到前面这么写，于是新功能也这么写。
```

第四阶段，心智模型崩塌。

```text
现在我也不知道数据到底从哪里流到哪里。
```

第五阶段，重构成本暴涨。

```text
不敢改，只能继续堆。
```

AI 没有创造这个问题，但它加速了这个过程。

## 熵管理不是“代码洁癖”

有些人听到重构、规范、检查，会觉得这是洁癖。其实不是。

熵管理的目标不是让代码看起来漂亮，而是保持三个能力：

1. 你还能理解系统。
2. AI 还能读懂系统。
3. 新功能还能低风险加入。

如果代码库乱到人和 AI 都只能猜，那么效率提升很快会消失。

Harness Engineering 的熵管理，就是把“保持可理解”变成持续动作。

## 黄金规则

OpenAI 的经验里有一个很重要的思路：把少数关键规则变成 Golden Rules。

黄金规则不是普通偏好，而是项目绝不能持续违反的不变量。

例如：

```text
1. Domain logic must not depend on UI.
2. All external API calls go through platform clients.
3. Every new runtime behavior needs a test.
4. Files over 500 lines must be split.
5. No duplicate schema definitions.
```

黄金规则要少。太多就没人看，也不好执行。

判断一条规则能不能成为黄金规则，可以问：

- 违反它会不会让代码更难维护？
- AI 是否容易重复违反？
- 能不能通过脚本、测试或 review 发现？
- 修复方向是否相对明确？

## 垃圾回收：定期清理，而不是等爆炸

程序语言里有垃圾回收。代码库也需要垃圾回收。

代码库垃圾包括：

- 死代码
- 重复逻辑
- 过时文档
- 临时 workaround
- 不再使用的配置
- 测试里复制出来的假数据
- 旧架构和新架构并存的中间状态

如果不清理，AI 会把这些都当成可参考材料。

轻量垃圾回收可以这样做：

```text
每周一次：
- 找出最大的 5 个文件。
- 找出重复最多的几个函数名。
- 找出 TODO/FIXME。
- 找出没有测试覆盖的新模块。
- 找出最近 AI 生成但你没读过的文件。
```

然后给 AI 一个清理任务：

```text
Read AGENTS.md and docs/architecture.md.
Inspect the largest files in src/domain.
Propose a refactor plan that reduces duplication without changing behavior.
Do not edit files yet.
```

先让它计划，再决定是否执行。

## 人类要保留“丑感”

AI 很擅长把代码写到“能跑”。但“能跑”和“好维护”之间还有距离。

个人开发者尤其要保留一种能力：看出代码变丑了。

所谓丑，不是风格不合你口味，而是出现这些信号：

- 一个函数开始做三件事。
- 一个文件越来越像杂物间。
- 新功能需要改很多不相关文件。
- 同一个概念有多个名字。
- 测试越来越难写。
- 修一个 bug 需要先理解一整片历史。

当你看到这些信号，就该把重构加入任务，而不是继续堆功能。

## 让 AI 帮你做熵扫描

AI 不只会制造熵，也可以帮助发现熵。

你可以定期让它做代码库巡检：

```text
Review the src directory for maintainability issues.
Focus on duplication, unclear boundaries, large files, and inconsistent naming.
Do not edit files. Produce a prioritized cleanup list.
```

更具体一点：

```text
Find places where UI imports storage or database modules directly.
Return file paths, why each case is risky, and the smallest safe refactor.
Do not change code yet.
```

注意这里强调 `Do not edit files yet`。熵扫描先要得到诊断，不要让 AI 一边诊断一边乱改。

## 从问题到规则

熵管理最重要的飞轮是：

```text
发现坏模式 -> 修掉当前实例 -> 总结规则 -> 加入 Harness -> 防止扩散
```

例如你发现 AI 多次把业务逻辑写进 UI 组件。

不要只修当前文件。要补三件事：

1. `AGENTS.md`：写明 UI 只能调用 service。
2. `docs/architecture.md`：画出依赖方向。
3. 检查脚本：扫描 UI import storage/repository。

这样当前问题变成了未来保护。

## 重构任务也要有验收标准

很多人让 AI 重构时，只说：

```text
帮我重构一下这块代码。
```

这太危险。重构必须有边界。

更好的任务：

```markdown
# Task: Split large note service

## Goal

Reduce `noteService.ts` size and separate import/export logic.

## Constraints

- Do not change public API behavior.
- Do not change database schema.
- Keep existing tests passing.
- Add tests only if behavior gaps are found.

## Target structure

- `noteQueryService.ts`
- `noteMutationService.ts`
- `noteExportService.ts`

## Verification

- Run unit tests.
- Run typecheck.
```

重构不是让 AI 自由发挥，而是在明确行为不变的前提下改善结构。

## 技术债是高息贷款

传统开发里，技术债已经很贵。AI 时代更贵，因为债务会被复制。

一个坏抽象过去可能只影响一个模块。现在 Agent 可能在十个新文件里模仿它。

所以 AI 时代的技术债更像高息贷款：

```text
今天省 10 分钟。
下周多出 3 个重复实现。
下个月重构成本翻倍。
```

Harness Engineering 的策略不是“永远不欠债”，而是“小额、可见、持续偿还”。

## 个人项目的清理节奏

如果你是个人开发者，可以用这个节奏。

每个任务后：

- 看一眼 diff。
- 确认测试通过。
- 确认没有明显跨层调用。

每周：

- 让 AI 生成 cleanup list。
- 选 1 到 2 个小重构执行。
- 更新 `AGENTS.md` 的禁止事项。

每月：

- 回顾架构文档是否过时。
- 删除无用代码和过时任务文件。
- 检查最大文件和重复逻辑。

这个节奏不重，但足以防止项目快速失控。

## 团队项目的清理机制

团队可以做得更系统：

- CI 强制黄金规则。
- 每周自动生成质量报告。
- 大文件、循环依赖、重复 schema 自动报警。
- 建立“清理 PR”惯例。
- 对 Agent 常犯错维护规则库。

团队里最关键的是，不要让清理变成“某个有洁癖的人负责”。它应该是 Harness 的一部分。

## 常见误区

### 误区一：AI 生成的代码以后再整理

以后通常不会来。至少要把清理任务记录下来，并定期处理。

### 误区二：重构可以一次性做大

AI 做大重构风险很高。更安全的是小步重构，每步都有测试。

### 误区三：坏模式只是风格问题

坏模式会被 AI 复制。它不是静态问题，而是扩散源。

### 误区四：只要测试通过就不用清理

测试通过说明行为大概率没坏，不说明结构健康。

## 小结

AI 编程时代，熵管理比以前更重要。

```text
AI 会模仿好模式，也会模仿坏模式。
坏模式会随着生成速度被放大。
重构要持续、小步、可验证。
每次发现重复错误，都要沉淀成规则。
```

Harness Engineering 的目标不是阻止 AI 写代码，而是让代码库始终保持可理解、可验证、可继续扩展。速度是收益，熵是成本。真正的效率来自两者之间的平衡。

## 系列导航

1. [Harness Engineering 入门：让 AI 不只是会写代码，而是稳定交付](/articles/AI/harness-engineering-for-beginners/)
2. [个人开发者的 Harness Engineering：一个人也能驾驭 AI 编程](/articles/AI/personal-harness-engineering/)
3. [仓库就是 AI 的记忆：AGENTS.md、任务文件和决策日志怎么写](/articles/AI/repo-as-agent-memory/)
4. [别反复提醒 AI：用测试、Lint 和反馈回路让它自己修](/articles/AI/mechanical-enforcement-and-feedback/)
5. [AI 写得越快，代码越容易乱：Harness Engineering 的熵管理](/articles/AI/entropy-and-codebase-garbage-collection/)
6. [从提示词到循环系统：Ralph Loop 如何让 AI Agent 持续工作](/articles/AI/ralph-loop-agent-orchestration/)
7. [不只写代码：用 Harness Engineering 批量翻译技术文章](/articles/AI/translation-as-harness/)
8. [Harness Engineering 的边界：评估难题、模型耦合与人的位置](/articles/AI/harness-engineering-limits-and-future/)
