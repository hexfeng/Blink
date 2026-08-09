# Blink Prompt 性能测试结果

## 结论

候选参数策略和 A/B 测试系统已完成，生产构建可用。当前环境没有 `BLINK_BENCHMARK_API_KEY`，因此没有执行真实 OpenAI 请求，也不对真实 Luna 延迟改善幅度作未经验证的声明。

候选生产策略：

| 模式 | reasoning effort | verbosity |
| --- | --- | --- |
| Auto | `none` | `low` |
| Concise | `none` | `low` |
| Professional | `low` | API 默认值 |
| Custom | `none` | `low` |

这些参数只发送给官方 `api.openai.com` 的 `gpt-5.6-luna`。其他 OpenAI 模型、OpenAI-compatible 网关、DeepSeek、Anthropic 和 Gemini 的请求协议没有改变。

## 已执行验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 单元与组件测试 | 通过 | 8 个测试文件，37 项测试全部通过 |
| Luna 参数映射 | 通过 | Auto、Concise、Custom=`none + low verbosity`；Professional=`low`；基线 A=`low` |
| OpenAI usage 解析 | 通过 | 覆盖 input、output、total、reasoning、cached input tokens 和 finish reason |
| 质量评分 | 通过 | 覆盖 URL、数字、代码块、引文、长度、结构、必需内容和禁止内容 |
| A/B 聚合 | 通过 | 覆盖中位数、P95、成功率、JSON 有效率、质量通过率、长度比和 token 均值 |
| TypeScript | 通过 | `npm run typecheck` |
| ESLint | 通过 | `npm run lint` |
| Chrome MV3 生产构建 | 通过 | `npm run build`，构建总大小 709.47 kB |
| Playwright E2E | 部分通过 | 4/5 通过；唯一失败是设置页既有颜色对比度，相关 CSS 本次未修改 |
| 真实 Luna A/B | 未执行 | 当前进程没有测试 API Key；运行器已提供 `npm run benchmark:live` |

E2E 失败详情：设置页已有 `#777777`/白色的 4.47:1、`#7b7b78`/白色的 4.24:1、`#858581`/白色的 3.7:1 对比度，低于 axe 对小字号文本要求的 4.5:1。该问题与本次性能和测试系统改动无关，因此没有扩大范围修改 UI。

## 测试系统输出

真实基准完成后生成：

- `tmp/benchmarks/ab-latest.md`：可读的整体与分模式 A/B 对比。
- `tmp/benchmarks/ab-latest.json`：聚合数据和逐样本指标，便于后续分析。

报告不会记录 API Key、原始 Prompt 或模型输出。逐样本只记录样本 ID、模式、A/B 版本、耗时、usage、质量分数、长度比、finish reason 和安全错误码。

## 上线判断状态

代码级回归门槛已通过，可以验证请求参数和指标系统本身。是否确认候选 B 带来真实速度改善，仍需在同一网络环境下使用 Luna 对完整语料至少运行 3 轮，并按 `PERFORMANCE_BENCHMARK.md` 的门槛比较延迟、reasoning tokens 和质量退化幅度。
