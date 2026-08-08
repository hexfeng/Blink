# Blink P0 验收矩阵

## 自动化门槛

| 范围 | 必须通过 |
| --- | --- |
| Prompt | 三种内置模式、自定义模式、注入文本、JSON 输出协议 |
| Provider | 三类请求映射、25 秒超时、安全错误、非空测试响应 |
| 安全 | 消息来源、顶层 frame、精确站点权限、Key 不出可信上下文 |
| 编辑器 | textarea、contenteditable、富文本、写回读回、恢复、撤销 |
| UI | 状态转换、菜单键盘操作、聚焦/草稿可见性、翻转定位 |
| 存储 | schemaVersion 1、回退自动模式、清除 Provider、完整重置 |

## 实站门槛

每个域名执行 PRD 中的八项路径，并增加：空且失焦时隐藏、200% 缩放、中英文布局、键盘路径、权限即时移除。未完成真实验证的站点必须标记 `externalBlocked`，不得显示为已验证。

| Wave | 产品 | 域名 | 当前证据 |
| --- | --- | --- | --- |
| A | ChatGPT | chatgpt.com | 待本地登录态验证 |
| A | Gemini | gemini.google.com | 待本地登录态验证 |
| A | Claude | claude.ai | 待本地登录态验证 |
| A | Grok | grok.com | 待本地登录态验证 |
| A | Qwen | chat.qwen.ai | 待本地登录态验证 |
| A | DeepSeek | chat.deepseek.com | 待本地登录态验证 |
| A | MiniMax | chat.minimax.io / agent.minimax.io | 待本地登录态验证 |
| A | Kimi | kimi.com | 待本地登录态验证 |
| A | GLM / Z.ai | chatglm.cn / z.ai | 待本地登录态验证 |
| B | 豆包 | doubao.com | 待本地登录态验证 |
| B | Copilot | copilot.microsoft.com | 待本地登录态验证 |
| B | Perplexity | perplexity.ai | 待本地登录态验证 |
| B | Vibe | chat.mistral.ai | 待本地登录态验证 |
| B | 腾讯元宝 | yuanbao.tencent.com | 待本地登录态验证 |
| B | 文心助手 | wenxin.baidu.com | 待本地登录态验证 |
| B | Meta AI | meta.ai | 地区与账号可用性待验证 |

## Provider 实测

站点适配使用本地确定性 OpenAI-compatible 测试服务隔离验证；OpenAI-compatible、Anthropic、Gemini 各自再以用户提供的 BYOK 在参考站点做一次端到端验证。API Key 不进入本文件。
