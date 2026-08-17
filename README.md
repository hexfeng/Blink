# Blink

Blink 是一个 Chrome Desktop MV3 扩展，在支持的 AI 对话网站输入框旁安全改写尚未发送的草稿。

## 当前状态

P0 功能与本地发布验收已经完成，当前版本为 0.1.1 Core Beta，优先保证 ChatGPT、Claude 和 Gemini。

- 工程里程碑：9/9（100%，按门槛计数，不代表工时权重）。
- 自动化：73/73 单元与组件测试通过；Playwright E2E 6/6 通过；0.1.1 ZIP 已完成结构、版本、权限与哈希检查。
- Core 站点：ChatGPT、Claude、Gemini；三站已有完整实站证据，0.1.1 优化、直接写回和精确 Undo 冒烟通过。
- Experimental 站点：其余 13 个适配器保留为显式可选功能，暂不作为当前 Core Beta 发布阻塞项。
- Provider：OpenAI-compatible 已完成真实模型全链路；Anthropic 与 Gemini 原生协议标记为 Preview，因暂缺 API Key 延后。
- 本地 Beta：0.1.0 已完成干净 Profile 的安装、升级模拟、Reset、卸载与重装；0.1.0→0.1.1 真实历史版本升级及配置、模式、权限保留验收通过。
- 当前发布结论：0.1.1 已达到本地 Core Beta 门槛；Experimental 站点与原生 Anthropic/Gemini Provider Preview 按计划延期，不计为本轮阻塞。

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
- 一个活动 Provider：OpenAI-compatible；Anthropic 与 Gemini 原生协议可选 Preview。
- 自动、精简、专业以及最多 5 个自定义模式。
- 用户逐站授权；Core 默认只展示 ChatGPT、Claude、Gemini，Experimental 站点需显式选择；没有“所有网站”开关。
- 不读取历史消息、附件或网页正文，不自动发送，不采集遥测。

核心文档：

- [P0 状态与下一步计划](./docs/STATUS.md)
- [PRD](./docs/PRD.md)
- [验收矩阵](./docs/ACCEPTANCE_MATRIX.md)
- [本地 Beta 生命周期验收](./docs/BETA_ACCEPTANCE.md)
- [接口与 Prompt 协议](./docs/PROTOCOLS.md)
- [状态与交互图](./docs/INTERACTIONS.md)
- [性能测试结果](./docs/PERFORMANCE_TEST_RESULTS.md)
- [视觉基线](./docs/DESIGN_BASELINE.md)

本地 UI 验收预览使用 `npm run preview:ui`；它直接复用生产组件，但不进入扩展构建。
