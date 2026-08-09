# Blink

Blink 是一个 Chrome Desktop MV3 扩展，在支持的 AI 对话网站输入框旁安全改写尚未发送的草稿。

## 本地开发

要求 Node.js 当前 LTS 与 Chrome 120+。

```powershell
npm install
npm run dev
```

生产构建：

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Luna Prompt A/B 基准使用独立的临时 API Key 环境变量，结果只写入已忽略的 `tmp/benchmarks/`：

```powershell
$env:BLINK_BENCHMARK_API_KEY = "仅用于本次测试的 Key"
npm run benchmark:live
Remove-Item Env:\BLINK_BENCHMARK_API_KEY
```

基准定义、指标和判定标准见 `docs/PERFORMANCE_BENCHMARK.md`。Key、原始 Prompt 和模型输出均不会写入报告。

在 `chrome://extensions` 开启开发者模式，加载 `.output/chrome-mv3`。首次安装会自动打开设置页；Provider API Key 只保存在 `chrome.storage.local`，不得加入仓库、截图或日志。

## P0 边界

- Chrome Desktop MV3，仅本地内测。
- 一个活动 Provider：OpenAI-compatible、Anthropic 或 Gemini。
- 自动、精简、专业以及最多 5 个自定义模式。
- 用户逐站授权；没有“所有网站”开关。
- 不读取历史消息、附件或网页正文，不自动发送，不采集遥测。

设计与验收资料位于 `docs/`。

本地 UI 验收预览使用 `npm run preview:ui`；它直接复用生产组件，但不进入扩展构建。
