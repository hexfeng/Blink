# Blink P0 状态与下一步计划

- 阶段：0.1.1 Core Beta 本地验收完成
- 更新日期：2026-08-16
- 当前发布范围：ChatGPT、Claude、Gemini + OpenAI-compatible Provider
- 发布状态：通过；最终包、真实升级、三站实站冒烟与 Chrome Errors 检查均已完成
- 相关文档：[PRD](./PRD.md) · [验收矩阵](./ACCEPTANCE_MATRIX.md) · [0.1.0 本地 Beta 验收](./BETA_ACCEPTANCE.md) · [性能结果](./PERFORMANCE_TEST_RESULTS.md) · [交互协议](./INTERACTIONS.md) · [视觉 QA](../design-qa.md)

## 1. 完成度口径

Blink 同时记录工程、自动化、实站、Provider 和发布包证据；代码存在不等于当前版本已完成实站验收。

| 进度线 | 当前结果 | 解释 |
| --- | --- | --- |
| P0 工程里程碑 | 9/9，100% | 0.1.1 Core Beta 本地发布验收闭环完成 |
| 单元与组件自动化 | 73/73 通过 | 11 个测试文件；包含三个 Core 站点目录与编辑器契约 |
| Playwright E2E | 6/6 通过 | Core 默认视图、Provider 提示、无障碍、200% 与编辑器回归通过 |
| Core 站点完整验收 | 3/3（0.1.1） | ChatGPT、Claude、Gemini 完整手工验收及 0.1.1 优化/写回/Undo 冒烟通过 |
| Experimental 站点 | 13 个适配器 | 保留现有实现与证据，暂不作为 0.1.1 Core Beta 阻塞项 |
| Provider 代码实现 | 3/3 | OpenAI-compatible、Anthropic、Gemini 均有协议映射与自动化 |
| 当前发布 Provider 实测 | 1/1 | OpenAI-compatible 已通过；Anthropic 与 Gemini 原生协议为 Preview |
| 本地 Beta 生命周期 | 0.1.0 与真实升级均通过 | 0.1.0 全生命周期完成；0.1.0→0.1.1 配置、模式和权限保留通过 |

发布分层：

- `Core`：本轮承诺完整支持并作为发布门槛的站点，仅 ChatGPT、Claude、Gemini。
- `Experimental`：可由用户显式授权的其他适配器；保留真实状态，但本轮不要求补齐完整矩阵。
- `Preview`：协议已实现且有自动化，但尚无真实凭据全链路证据；当前为 Anthropic 与 Gemini 原生 Provider。
- 站点与 Provider 相互独立；例如 Claude 网站可以使用 OpenAI-compatible Provider。

验证状态仍保持严格含义：

- `pendingVerification`：已实现且允许授权，但尚未完成完整实站验收。
- `verified`：已按验收矩阵完成真实站点或真实 Provider 全链路验证。
- `externalBlocked`：账号、地区或登录墙阻止当前验收；不得显示为已验证。

## 2. P0 里程碑

| # | 里程碑 | 状态 | 当前证据 |
| ---: | --- | --- | --- |
| 1 | Chrome MV3、动态脚本与按站授权 | completed | Host Permission 是站点启用唯一事实来源；启停与重置路径已实现 |
| 2 | 当前草稿识别、SPA 生命周期与定位 | completed | textarea、contenteditable、富文本、重新挂载和 200% 定位有自动化/浏览器证据 |
| 3 | Auto、Concise、Professional 与自定义模式 | completed | Prompt 组装、模式切换、键盘菜单和最多 5 个自定义模式已覆盖 |
| 4 | BYOK Provider 与模型选择器 | completed | 三种协议、推荐/在线/自定义模型、测试与保存分离已实现 |
| 5 | 安全替换、恢复与单步撤销 | completed | 快照比较、写回读回、恢复、撤销失效条件已覆盖 |
| 6 | 设置页与站点分层 | completed | Core / Experimental / Enabled、搜索、权限开关和 Provider 独立说明已实现 |
| 7 | Luna 延迟优化与 A/B 系统 | completed | 96 次真实请求；Auto/Concise 使用 `none + low`，Professional 保持 `low` |
| 8 | 构建、测试与视觉回归 | completed | TypeScript、ESLint、73 项测试、E2E 6/6、MV3 构建与 ZIP 检查通过 |
| 9 | 0.1.1 Core Beta 发布验收 | completed | 最终 ZIP、真实升级、三站复验、密钥扫描、Chrome Errors 与对抗式审查均通过 |

## 3. 已验证内容

- Blink 只读取当前未发送草稿，不读取历史、附件或网页正文，也不自动发送。
- Provider API Key 只保存在受限的 `chrome.storage.local`，不进入 Content Script、日志或报告。
- Auto、Concise、Professional、自定义模式、直接替换、单步 Undo、错误恢复和权限移除均有自动化或浏览器证据。
- ChatGPT、Gemini、Claude 已完成完整手工验收；0.1.1 使用同一中文草稿分别完成优化、直接写回和精确 Undo。
- OpenAI-compatible 已用真实 OpenAI 模型完成设置、实站优化、写回和 Undo；同一个 Provider 可用于任一聊天网站。
- 0.1.1 设置页默认只展示三个 Core 站点；Experimental 需要用户显式切换和授权；Enabled 可用于管理所有已有权限。
- 0.1.1 生产构建和 ZIP 已生成；Manifest 版本为 0.1.1、MV3、无静态 Host Permission、包含 25 个可选 Host Permission。
- 0.1.0 的首次安装、升级模拟、Reset、卸载和重装结果保留为历史证据；真实 0.1.0→0.1.1 升级已确认 Provider、`Upgrade Marker`、Concise 活动模式和三个 Core 站点权限保留。
- 最终构建 Reload 后再次完成三站优化与 Undo；`chrome://extensions` 未产生新的 Blink Errors。

## 4. 未完成与非阻塞项

### P0-A 0.1.1 Core 三站冒烟：已关闭

ChatGPT、Claude、Gemini 均只有一个 Blink；悬浮窗与 Composer 右边缘对齐、间距 12px；同一中文草稿完成真实 OpenAI-compatible 优化、直接写回和单步 Undo，原文均精确恢复。源码 `lastVerifiedVersion` 已更新为 0.1.1。

### P0-B 真实历史版本升级：已关闭

在此前通过生命周期验收的独立 Chrome Profile 中，先以真实 0.1.0 建立 Provider、`Upgrade Marker`、Concise 和三个 Core 权限，再原位升级到 0.1.1。版本、配置、模式、权限与设置页新分层均由用户确认保留；该证据不同于 0.0.9→0.1.0 的同代码版本模拟。

### P0-C Provider Preview：非本轮阻塞

- Anthropic：`Preview / pendingVerification`，当前缺少 API Key。
- Gemini 原生协议：`Preview / pendingVerification`，当前缺少 API Key。

缺少凭据不记为失败，也不影响以 OpenAI-compatible 为正式 Provider 的 0.1.1 Core Beta。凭据具备后再分别执行测试连接、真实优化、写回和 Undo。

### P0-D Experimental 站点：非本轮阻塞

- 核心优化、写回与 Undo 已通过但仍为 `pendingVerification`：Grok、Qwen、MiniMax、Kimi、GLM / Z.ai、Copilot、Perplexity。
- 尚待完整实测：文心助手、Meta AI。
- `externalBlocked`：DeepSeek、豆包、Vibe、腾讯元宝。

这些状态和既有证据继续保留，但按用户决定暂不补齐其完整矩阵。含长追踪参数的 URL 仍可能因模型输出未通过严格 JSON/URL 保留校验而返回 `INVALID_RESPONSE`；错误发生在写回之前，原文不应被修改。

## 5. 后续开发计划

1. **Core 稳定性优先**
   优先处理 ChatGPT、Claude、Gemini 的真实页面变化、定位回归、写回与 Undo 问题。
2. **Provider Preview 按条件补验**
   获得 Anthropic 或 Gemini API Key 后，再分别执行原生协议测试连接、优化、写回与 Undo；通过前不升级为 verified。
3. **Experimental 按需求推进**
   只有在账号、地区条件或明确用户需求具备时，才继续补齐其完整矩阵；不因现有核心回归结果宣称全面支持。
4. **决定下一发布阶段**
   收集 0.1.1 Core Beta 反馈后，再决定扩大站点范围、准备商店发布，或进入 P1；当前不提前实现账号、遥测或云服务。

## 6. P0 后暂缓

- 账号、订阅、云代理和团队协作。
- 遥测、远程站点兼容配置和自动更新选择器。
- 多 Provider 路由、自动故障转移和本地模型。
- 历史记录、收藏、同步、上下文读取和自动发送。

这些项目只有在 0.1.1 Core Beta 闭环并确认下一阶段后再评估。
