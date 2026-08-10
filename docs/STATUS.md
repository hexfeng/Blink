# Blink P0 状态与下一步计划

- 阶段：P0 功能完成，本地内测验收中
- 更新日期：2026-08-09
- 发布状态：未达到发布门槛
- 相关文档：[PRD](./PRD.md) · [验收矩阵](./ACCEPTANCE_MATRIX.md) · [性能结果](./PERFORMANCE_TEST_RESULTS.md) · [交互协议](./INTERACTIONS.md) · [视觉 QA](../design-qa.md)

## 1. 完成度口径

Blink 同时使用两条进度线，避免把“代码已实现”误写成“产品已验收”。

| 进度线 | 当前结果 | 解释 |
| --- | --- | --- |
| P0 工程里程碑 | 8/9，89% | 按里程碑门槛计数，不代表工时权重；剩余门槛是发布验收闭环 |
| 单元与组件自动化 | 48/48 通过 | 10 个测试文件 |
| Playwright E2E | 5/6 通过 | 设置页颜色对比度仍有 1 项 serious axe 违规 |
| 实站完整验收 | 0/16 产品 | Gemini 有局部 DOM/定位证据，但尚未完成八项路径 |
| Provider 协议实现 | 3/3 | OpenAI-compatible、Anthropic、Gemini 均有代码级映射与测试 |
| Provider 扩展全链路验收 | 待完成 | 需要 BYOK 设置、真实 Provider 请求、实站写回和撤销的连续证据 |

状态词定义：

- `completed`：需求已实现，并有当前仓库的自动化或浏览器证据。
- `pendingVerification`：已实现且允许测试者授权，但尚未完成登录态实站验收。
- `verified`：已按验收矩阵完成真实站点或真实 Provider 全链路验证。
- `externalBlocked`：账号、地区或登录墙阻止当前验收；不得显示为已支持。

## 2. P0 里程碑

| # | 里程碑 | 状态 | 当前证据 |
| ---: | --- | --- | --- |
| 1 | Chrome MV3、动态脚本与按站授权 | completed | Host Permission 是站点启用唯一事实来源；启停与重置路径已实现 |
| 2 | 当前草稿识别、SPA 生命周期与定位 | completed | textarea、contenteditable、富文本、重新挂载和 200% 定位有自动化/浏览器证据 |
| 3 | Auto、Concise、Professional 与自定义模式 | completed | Prompt 组装、模式切换、键盘菜单和最多 5 个自定义模式已覆盖 |
| 4 | BYOK Provider 与模型选择器 | completed | 三种协议、推荐/在线/自定义模型、测试与保存分离已实现 |
| 5 | 安全替换、恢复与单步撤销 | completed | 快照比较、写回读回、恢复、撤销失效条件已覆盖 |
| 6 | 设置页与站点应用商店卡片 | completed | 16 个站点、Logo、搜索、All/Enabled 筛选和权限开关已完成视觉验收 |
| 7 | Luna 延迟优化与 A/B 系统 | completed | 96 次真实请求；Auto/Concise 使用 `none + low`，Professional 保持 `low` |
| 8 | 构建、单元测试与视觉回归 | completed | TypeScript、ESLint、48 项测试、MV3 构建、设置页和悬浮窗视觉 QA 已通过 |
| 9 | 发布验收闭环 | in progress | E2E 5/6；真实站点与三类 Provider 全链路证据未完成 |

## 3. 当前已验证内容

- Blink 只读取当前未发送草稿，不读取历史、附件或网页正文，也不自动发送。
- Provider API Key 只保存在受限的 `chrome.storage.local`，不进入 Content Script、日志或报告。
- 模型组合框支持推荐模型、Provider 在线模型和自定义模型 ID；自定义 OpenAI-compatible URL 不冒充官方 OpenAI 模型目录。
- Auto、Concise 和 Custom 对官方 `gpt-5.6-luna` 使用 `reasoning_effort: none` 与 `verbosity: low`；Professional 使用 `low` 和默认 verbosity。
- 16 个站点以卡片目录展示；15 个为 `pendingVerification`，Meta AI 为 `externalBlocked`。
- 悬浮窗默认、菜单、加载、相同结果、成功、错误和恢复状态已实现；模式区色块和扩展 Reload 生命周期错误已修复。
- 当前构建可从 `.output/chrome-mv3` 以开发者模式加载。

## 4. 未完成与阻塞

### P0-A 设置页无障碍

`npm run test:e2e` 当前 5/6 通过。唯一失败为小字号文字的 WCAG 2 AA 颜色对比度，包括：

- `#777777` / 白色：4.47:1。
- `#7b7b78` / 白色：4.24:1。
- `#858581` / 白色：3.70:1。
- `#168557` / `#f0f8f4`：4.29:1。
- 站点域名 `#777773` / 白色：4.49:1。

退出条件：不改变当前视觉层级，只调整相关文字 token，使 E2E 6/6 且无 serious/critical axe 违规。

### P0-B 实站验收

- 完整 `verified`：0/16。
- 局部证据：Gemini 已确认编辑器和 Composer 外框选择器。
- `pendingVerification`：ChatGPT、Gemini、Claude 等 15 个产品状态中的 14 个没有额外实站证据，Gemini仍需完整路径。
- `externalBlocked`：Meta AI，受地区与账号可用性影响。

退出条件：逐站完成 [验收矩阵](./ACCEPTANCE_MATRIX.md) 的八项路径、缩放/键盘/权限移除补充项，并在源码中只把有完整证据的站点改为 `verified`。

### P0-C Provider 全链路

Luna A/B 已证明官方 OpenAI 请求和参数策略，但不能替代扩展内的 Provider 全链路验收。OpenAI-compatible、Anthropic 和 Gemini 仍需分别完成：保存 BYOK → 测试连接 → 实站优化 → 写回 → 撤销。API Key 和模型输出不得写入文档。

## 5. 下一步计划

按以下顺序推进，不在发布门槛前扩展 P1 功能：

1. **修复设置页颜色对比度**  
   验证：`npm run test:e2e` 从 5/6 提升到 6/6。
2. **完成三个参考站点验收：ChatGPT → Gemini → Claude**  
   验证：每站八项路径、200% 缩放、键盘、权限即时移除；Reload 后先刷新页面并清理旧 Errors 记录。
3. **完成三类 Provider 的扩展全链路验收**  
   验证：OpenAI-compatible、Anthropic、Gemini 各有一条不含凭据的通过记录。
4. **完成 Wave A 其余站点**  
   验证：Grok、Qwen、DeepSeek、MiniMax、Kimi、GLM / Z.ai 逐项更新为 `verified` 或记录真实阻塞。
5. **执行 Wave B 和 Meta AI 阻塞复核**  
   验证：豆包、Copilot、Perplexity、Vibe、腾讯元宝、文心助手完成验收；Meta AI 保持或解除 `externalBlocked`，不得猜测。
6. **本地内测发布包**  
   验证：干净 Chrome Profile 安装、首次设置、升级、重置、卸载清理、ZIP 构建和已知问题说明全部通过。

## 6. P0 后暂缓

- 账号、订阅、云代理和团队协作。
- 遥测、远程站点兼容配置和自动更新选择器。
- 多 Provider 路由、自动故障转移和本地模型。
- 历史记录、收藏、同步、上下文读取和自动发送。

这些项目只有在 P0 本地内测门槛完成并决定正式发布后再评估。
