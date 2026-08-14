# Blink P0 验收矩阵

- 状态：本地内测验收中
- 更新日期：2026-08-14
- 汇总与执行顺序：[P0 状态与下一步计划](./STATUS.md)

当前自动化快照：71/71 单元与组件测试通过；Playwright E2E 6/6 通过。ChatGPT、Gemini、Claude 已由用户报告完成完整手工验收；另有 7 个产品完成真实 Provider 的核心优化/写回/Undo 回归。Blink 0.1.0 本地 Beta 生命周期验收已通过。

## 自动化门槛

| 范围 | 必须通过 |
| --- | --- |
| Prompt | 三种内置模式差异、自定义模式、宽泛分析请求的实质展开与结构化换行、简单任务不过度扩写、注入文本、JSON 输出协议 |
| Provider | 三类请求映射、25 秒超时、安全错误、非空测试响应 |
| 性能 | Luna 模式参数映射、A/B 顺序交替、延迟与 usage 解析、质量门槛评分、报告不包含 Key、原始 Prompt 或模型输出 |
| 安全 | 消息来源、顶层 frame、精确站点权限、Key 不出可信上下文 |
| 编辑器 | textarea、contenteditable、富文本、写回读回、恢复、撤销 |
| UI | 状态转换、菜单键盘操作、聚焦/草稿可见性、与完整 Composer 外框右边缘对齐、外框上方 8px 零重叠、长草稿内部滚动不漂移 |
| 存储 | schemaVersion 1、回退自动模式、清除 Provider、完整重置 |

## 实站门槛

每个域名执行 PRD 中的八项路径，并增加：空且失焦时隐藏、200% 缩放、中英文布局、键盘路径、权限即时移除。尚未实测但可由测试者授权的站点标记 `pendingVerification`；它允许开启权限，但不得显示为已验证。只有确有账号、地区或登录墙阻塞的站点标记 `externalBlocked` 并禁用开关。

| Wave | 产品 | 域名 | 状态 | 当前证据 |
| --- | --- | --- | --- | --- |
| A | ChatGPT | chatgpt.com | `verified` | 用户报告完成完整手工验收；浏览器证据包含真实优化、直接写回与精确 Undo |
| A | Gemini | gemini.google.com | `verified` | 用户报告完成完整手工验收；Reload 后真实优化与 Undo 复验通过 |
| A | Claude | claude.ai | `verified` | 用户报告完成完整手工验收；20px ProseMirror 与 `fieldset` 锚点实站通过 |
| A | Grok | grok.com | `pendingVerification` | 真实 OpenAI-compatible 请求完成 207→313 字符写回，Undo 精确恢复；完整矩阵待补 |
| A | Qwen | chat.qwen.ai | `pendingVerification` | 真实请求完成 207→340 字符写回，Undo 精确恢复；完整矩阵待补 |
| A | DeepSeek | chat.deepseek.com | `externalBlocked` | 当前登录墙阻止聊天编辑器验收 |
| A | MiniMax | chat.minimax.io / agent.minimax.io | `pendingVerification` | 真实请求完成 207→337 字符写回，Undo 精确恢复；完整矩阵待补 |
| A | Kimi | kimi.com / www.kimi.com | `pendingVerification` | Composer 锚点与重复写入已修复；正常提示词写回、无重复和 Undo 通过；完整矩阵待补 |
| A | GLM / Z.ai | chatglm.cn / z.ai / chat.z.ai | `pendingVerification` | 真实请求完成 207→354 字符写回，Undo 精确恢复；完整矩阵待补 |
| B | 豆包 | doubao.com / www.doubao.com | `externalBlocked` | 当前地区或账号状态阻止实站验收 |
| B | Copilot | copilot.microsoft.com | `pendingVerification` | 真实请求完成 207→331 字符写回，Undo 精确恢复；完整矩阵待补 |
| B | Perplexity | perplexity.ai / www.perplexity.ai | `pendingVerification` | 富文本重复写入已修复；正常提示词写回与 Undo 通过，原始 207 字符草稿已精确恢复；完整矩阵待补 |
| B | Vibe | chat.mistral.ai | `externalBlocked` | 验收前需要用户接受站点服务条款 |
| B | 腾讯元宝 | yuanbao.tencent.com | `externalBlocked` | 当前登录状态下输入框不可用 |
| B | 文心助手 | wenxin.baidu.com | `pendingVerification` | 已配置当前 textarea 选择器，尚未完成实站优化与 Undo |
| B | Meta AI | meta.ai | `pendingVerification` | 已确认当前纯文本 input 适配，尚未完成完整实站验收 |

Kimi 与 Perplexity 对普通提示词的写回已经通过。含长追踪参数的 URL 提示词仍可能因单次模型输出未通过严格 JSON/URL 保留校验而返回 `INVALID_RESPONSE`；浏览器追踪确认错误发生在写回之前，不能把它归因于站点编辑器。

## Provider 实测

站点适配使用本地确定性 OpenAI-compatible 测试服务隔离验证；OpenAI-compatible、Anthropic、Gemini 各自再以用户提供的 BYOK 在参考站点做一次端到端验证。API Key 不进入本文件。

| 协议 | 状态 | 当前证据 |
| --- | --- | --- |
| OpenAI-compatible | `verified` | 用户使用真实 OpenAI 模型完成设置、真实站点优化、写回和 Undo；本轮七站回归继续通过 |
| Anthropic | `pendingVerification` | 当前没有可用 API Key，按用户决定延后 |
| Gemini 原生协议 | `pendingVerification` | 当前没有可用 API Key，按用户决定延后 |

## 本地 Beta 发布包

| 范围 | 状态 | 当前证据 |
| --- | --- | --- |
| ZIP 产物 | `verified` | 0.1.0、341369 bytes、Manifest 位于根目录、SHA-256 已记录 |
| 首次安装 | `verified` | 独立 Chrome Profile 默认状态、首次设置、OpenAI-compatible、ChatGPT 按需权限、优化与 Undo 通过 |
| 本地升级模拟 | `verified` | 固定目录 0.0.9→0.1.0，Provider、模式和权限保留，无重复注入；不代表 Web Store 自动升级 |
| Reset | `verified` | Provider、API Key、模式、权限和页面注入全部清除，重新配置后功能正常 |
| 卸载与重装 | `verified` | 卸载后页面无 Blink；同路径重装 0.1.0 恢复完整默认状态 |

环境、扩展 ID、哈希和人工/自动证据边界见 [本地 Beta 生命周期验收](./BETA_ACCEPTANCE.md)。
