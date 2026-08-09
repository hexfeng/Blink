# Blink Prompt 性能与质量 A/B 基准

## 目标

用同一批 Prompt、同一模型和同一输出协议，对比请求参数变化带来的延迟、token 使用和优化质量差异。基准只面向官方 `gpt-5.6-luna`，不会把 OpenAI 专用参数发送给 DeepSeek、Anthropic、Gemini 或其他兼容服务。

## A/B 配置

| 模式 | 基线 A | 候选 B |
| --- | --- | --- |
| Auto | `reasoning_effort: low`，默认 verbosity | `reasoning_effort: none`，`verbosity: low` |
| Concise | `reasoning_effort: low`，默认 verbosity | `reasoning_effort: none`，`verbosity: low` |
| Professional | `reasoning_effort: low`，默认 verbosity | `reasoning_effort: low`，默认 verbosity |
| Custom | `reasoning_effort: low`，默认 verbosity | `reasoning_effort: none`，`verbosity: low` |

生产扩展使用候选 B。Provider 连接测试维持 `low`，避免把模式策略与连接诊断混在一起。

## 记录指标

- 端到端请求耗时：从调用 Provider 到完整 JSON 响应解析前，单位毫秒。
- 中位数与 P95 延迟：只统计成功样本。
- input、output、reasoning、cached input tokens：直接读取 OpenAI `usage`，缺失时保留为空，不做估算。
- JSON 有效率：响应是否满足严格的 `optimized_prompt` JSON 合约。
- 安全校验：长度限制和 URL 完整保留是否通过。
- 输出/输入字符比：用于识别无必要扩写。
- 质量评分：检查非空、URL、数字、代码块、引文，以及语料定义的长度、结构、必需内容和禁止内容。

质量评分是确定性回归门槛，不等同于人工主观评分。最终上线判断仍需抽查原始输出是否自然、准确、可直接执行。

## 运行方法

API Key 只通过当前进程环境传入。不要把 Key 写入命令脚本、报告、截图或仓库文件。

```powershell
$env:BLINK_BENCHMARK_API_KEY = "仅用于本次测试的 Key"
$env:BLINK_BENCHMARK_RUNS = "3"
npm run benchmark:live
Remove-Item Env:\BLINK_BENCHMARK_API_KEY
Remove-Item Env:\BLINK_BENCHMARK_RUNS
```

默认对 `docs/PROMPT_CORPUS.json` 的全部样本各运行一轮 A 和 B。为了先做低成本冒烟测试，可设置：

```powershell
$env:BLINK_BENCHMARK_CASE_LIMIT = "3"
```

允许的参数：

- `BLINK_BENCHMARK_RUNS`：每个样本 1–5 轮，默认 1。
- `BLINK_BENCHMARK_CASE_LIMIT`：只运行语料前 N 条，默认全部。
- `BLINK_BENCHMARK_MODEL`：当前只接受 `gpt-5.6-luna`。

Markdown 和 JSON 报告生成在 `tmp/benchmarks/ab-latest.*`。报告只包含样本 ID、模式、聚合指标和安全错误码，不保存 API Key、原始 Prompt 或模型输出。

## 偏差控制

- 每条样本必须同时运行 A、B，形成配对比较。
- A、B 请求顺序按样本和轮次交替，降低缓存、网络波动和服务负载造成的顺序偏差。
- 不并发发送，以免客户端并发和速率限制污染单请求延迟。
- 正式结论至少运行 3 轮；单轮结果只用于冒烟检查。
- 使用相同模型、语料、JSON schema、最大输出 token 和网络环境。

## 候选通过标准

候选 B 同时满足以下条件才建议保留：

1. 成功率和 JSON 有效率不得低于基线。
2. 平均质量评分下降不超过 2 分，质量通过率下降不超过 5 个百分点。
3. Auto、Concise 与 Custom 的中位延迟或 reasoning tokens 至少一项有明确改善。
4. Professional 与基线参数相同，其结果只用于确认测试噪声和回归边界。
5. 人工抽查长 Prompt、数字/链接/代码样本，没有关键约束丢失或明显过度压缩。

## 自动化验证

`npm test` 覆盖模式参数映射、OpenAI usage 解析、质量评分与聚合统计；标准测试不会触发真实 API 或读取 `BLINK_BENCHMARK_API_KEY`。只有显式运行 `npm run benchmark:live` 才会产生外部请求和 API 费用。
