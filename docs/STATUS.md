# Blink P0 状态与下一步计划

- 阶段：P0 功能完成，本地内测验收中
- 更新日期：2026-08-14
- 发布状态：未达到发布门槛
- 相关文档：[PRD](./PRD.md) · [验收矩阵](./ACCEPTANCE_MATRIX.md) · [本地 Beta 验收](./BETA_ACCEPTANCE.md) · [性能结果](./PERFORMANCE_TEST_RESULTS.md) · [交互协议](./INTERACTIONS.md) · [视觉 QA](../design-qa.md)

## 1. 完成度口径

Blink 同时使用两条进度线，避免把“代码已实现”误写成“产品已验收”。

| 进度线 | 当前结果 | 解释 |
| --- | --- | --- |
| P0 工程里程碑 | 8/9，89% | 按里程碑门槛计数，不代表工时权重；剩余门槛是发布验收闭环 |
| 单元与组件自动化 | 71/71 通过 | 11 个测试文件 |
| Playwright E2E | 6/6 通过 | 设置页无 serious/critical axe 违规；200% 成功态保持在视口内 |
| 实站完整验收 | 3/16 产品 | ChatGPT、Gemini、Claude 为用户报告的完整手工验收；另有 7 个产品完成核心优化/Undo 回归 |
| Provider 协议实现 | 3/3 | OpenAI-compatible、Anthropic、Gemini 均有代码级映射与测试 |
| Provider 扩展全链路验收 | 1/3 | OpenAI-compatible 已通过；Anthropic、Gemini 原生协议因暂缺 API Key 延后 |

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
| 8 | 构建、单元测试与视觉回归 | completed | TypeScript、ESLint、71 项测试、E2E 6/6、MV3 构建、设置页和悬浮窗视觉 QA 已通过 |
| 9 | 发布验收闭环 | in progress | 三个参考站点完整验收、七站核心回归、OpenAI-compatible 全链路和本地 Beta 生命周期已完成；其余站点矩阵与两类 Provider 仍未闭环 |

## 3. 当前已验证内容

- Blink 只读取当前未发送草稿，不读取历史、附件或网页正文，也不自动发送。
- Provider API Key 只保存在受限的 `chrome.storage.local`，不进入 Content Script、日志或报告。
- 模型组合框支持推荐模型、Provider 在线模型和自定义模型 ID；自定义 OpenAI-compatible URL 不冒充官方 OpenAI 模型目录。
- Auto、Concise 和 Custom 对官方 `gpt-5.6-luna` 使用 `reasoning_effort: none` 与 `verbosity: low`；Professional 使用 `low` 和默认 verbosity。
- ChatGPT、Gemini、Claude 已由用户确认完成完整手工验收。
- Grok、Qwen、MiniMax、Kimi、GLM / Z.ai、Copilot、Perplexity 已用真实 OpenAI-compatible Provider 验证优化、写回和单步 Undo；它们在补齐全部矩阵前仍按 `pendingVerification` 管理。
- Kimi 的 Composer 锚点与富文本重复写入已修复；Perplexity 富文本写回、Undo 和原文恢复已通过浏览器回归。
- DeepSeek、豆包、Vibe、腾讯元宝分别受登录、地区、条款确认或账号状态阻塞；文心助手与 Meta AI 仍待完整实测。
- 悬浮窗默认、菜单、加载、相同结果、成功、错误和恢复状态已实现；模式区色块、扩展 Reload 生命周期错误和富文本重复写入已修复。
- 当前构建可从 `.output/chrome-mv3` 以开发者模式加载。
- Blink 0.1.0 ZIP 已在独立 Chrome Profile 完成首次安装、0.0.9→0.1.0 本地升级模拟、Reset、卸载和同路径重装；完整证据见 [本地 Beta 生命周期验收](./BETA_ACCEPTANCE.md)。

## 4. 未完成与阻塞

### P0-A 设置页无障碍：已关闭

相关文字 token 已调整；`npm run test:e2e` 为 6/6，设置页无 serious/critical axe 违规。

### P0-B 实站验收

- 完整手工验收：3/16，分别为 ChatGPT、Gemini、Claude；由用户于 2026-08-09 报告通过完整路径。
- 核心链路通过但仍为 `pendingVerification`：Grok、Qwen、MiniMax、Kimi、GLM / Z.ai、Copilot、Perplexity。浏览器回归已证明注入、定位、优化写回、无重复和 Undo，但尚未逐站补齐全部八项路径、200% 缩放、键盘与权限移除。
- 尚待实测：文心助手、Meta AI。
- `externalBlocked`：DeepSeek（登录）、豆包（地区/账号）、Vibe（条款确认）、腾讯元宝（登录）。

已知边界：含长追踪参数的 URL 提示词可能因单次模型输出未通过严格 JSON/URL 保留校验而显示 `Invalid model response`。50ms 编辑器追踪确认该错误发生在写回前，原文不应被修改；正常提示词在 Kimi 和 Perplexity 均已完成写回与 Undo。

退出条件：逐站完成 [验收矩阵](./ACCEPTANCE_MATRIX.md) 的八项路径、缩放/键盘/权限移除补充项，并在源码中只把有完整证据的站点改为 `verified`。

### P0-C Provider 全链路

- OpenAI-compatible：`verified`。用户使用真实 OpenAI 模型完成设置、实站优化、写回和撤销；本轮七站回归继续使用同一 Provider。
- Anthropic：`pendingVerification`，当前缺少 API Key。
- Gemini 原生协议：`pendingVerification`，当前缺少 API Key。

缺少凭据不记为失败，也不允许把未执行的协议写成已验证。API Key 和模型输出不得写入文档。

### P0-D 本地 Beta 生命周期：已关闭

Blink 0.1.0 在 Chrome 151 的独立 `--user-data-dir` Profile 中完成 ZIP 安装、默认状态、OpenAI-compatible 首次使用、按需站点权限、0.0.9→0.1.0 本地升级模拟、Reset、卸载和重装。升级基线仅修改构建产物的 Manifest 版本，因此该结果证明本地未打包扩展的数据与生命周期兼容性，不代表 Chrome Web Store 自动升级。

## 5. 下一步计划

按以下顺序推进，不在发布门槛前扩展 P1 功能：

1. **补齐七个核心链路已通过站点的完整矩阵**
   对 Grok、Qwen、MiniMax、Kimi、GLM / Z.ai、Copilot、Perplexity 只补测尚缺的模式、长草稿、200% 缩放、键盘、撤销失效、错误恢复和权限即时移除，不重复已经通过的基础优化/Undo。
2. **完成文心助手与 Meta AI 实站验收**
   验证：当前编辑器选择器、定位、优化写回和 Undo；遇到真实账号或地区阻塞时才改为 `externalBlocked`。
3. **复核四个外部阻塞站点**
   DeepSeek、豆包、Vibe、腾讯元宝仅在账号、地区或条款条件具备时继续；否则保留具体阻塞，不猜测支持状态。
4. **凭据具备后补齐 Provider**
   Anthropic 与 Gemini 原生协议分别完成测试连接、实站优化、写回和撤销；在此之前保持 `pendingVerification`。
5. **最终状态同步与发布门槛审查**
   统一源码站点状态、README、验收矩阵和已知问题，执行全量自动化、密钥扫描与对抗式审查后再决定是否扩大本地 Beta。

## 6. P0 后暂缓

- 账号、订阅、云代理和团队协作。
- 遥测、远程站点兼容配置和自动更新选择器。
- 多 Provider 路由、自动故障转移和本地模型。
- 历史记录、收藏、同步、上下文读取和自动发送。

这些项目只有在 P0 本地内测门槛完成并决定正式发布后再评估。
