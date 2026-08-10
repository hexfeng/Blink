# Blink

Blink 是一个 Chrome Desktop MV3 扩展，在支持的 AI 对话网站输入框旁安全改写尚未发送的草稿。

## 当前状态

P0 功能已经完成，项目处于本地内测验收阶段，尚未达到发布门槛。

- 工程里程碑：8/9（89%，按门槛计数，不代表工时权重）。
- 自动化：48/48 单元与组件测试通过；Playwright E2E 5/6 通过。
- 实站验收：0/16 产品完成完整路径；Gemini 有局部证据，Meta AI 为 `externalBlocked`。
- 当前首要阻塞：设置页小字号颜色对比度、真实站点验收、三类 Provider 扩展全链路验收。

完整完成度、证据边界和下一步顺序见 [P0 状态与下一步计划](./docs/STATUS.md)。

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

扩展代码更新后的验收顺序：先在 `chrome://extensions` Reload Blink，再刷新目标 AI 网站；Chrome Errors 页面会保留旧记录，开始新一轮验收前应先清理历史记录。

## P0 边界

- Chrome Desktop MV3，仅本地内测。
- 一个活动 Provider：OpenAI-compatible、Anthropic 或 Gemini。
- 自动、精简、专业以及最多 5 个自定义模式。
- 用户逐站授权；没有“所有网站”开关。
- 不读取历史消息、附件或网页正文，不自动发送，不采集遥测。

核心文档：

- [P0 状态与下一步计划](./docs/STATUS.md)
- [PRD](./docs/PRD.md)
- [验收矩阵](./docs/ACCEPTANCE_MATRIX.md)
- [接口与 Prompt 协议](./docs/PROTOCOLS.md)
- [状态与交互图](./docs/INTERACTIONS.md)
- [性能测试结果](./docs/PERFORMANCE_TEST_RESULTS.md)
- [视觉基线](./docs/DESIGN_BASELINE.md)

本地 UI 验收预览使用 `npm run preview:ui`；它直接复用生产组件，但不进入扩展构建。
