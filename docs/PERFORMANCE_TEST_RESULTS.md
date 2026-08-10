# Blink Prompt 性能测试结果

> 本文件保留 2026-08-09 A/B 决策时的测试快照。当前仓库的测试数量、E2E 状态和发布阻塞见 [P0 状态与下一步计划](./STATUS.md)。

## 结论

候选参数策略和 A/B 测试系统已完成。2026-08-09 使用官方 `gpt-5.6-luna` 对 16 个完整语料各运行 3 轮 A/B，共完成 96 次真实请求。候选 B 的整体中位延迟降低 18.4%，没有成功率、JSON 有效率或自动质量门槛回归，因此保留为生产策略。

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
| 真实 Luna A/B | 通过 | 16 个用例 × 3 轮 × A/B，共 96 次请求全部成功，JSON 有效率 100% |

E2E 失败详情：设置页已有 `#777777`/白色的 4.47:1、`#7b7b78`/白色的 4.24:1、`#858581`/白色的 3.7:1 对比度，低于 axe 对小字号文本要求的 4.5:1。该问题与本次性能和测试系统改动无关，因此没有扩大范围修改 UI。

## 全量 A/B 结果

| 指标 | 基线 A | 候选 B | B 相对 A |
| --- | ---: | ---: | ---: |
| 成功请求 | 48/48 | 48/48 | 无回归 |
| 中位延迟 | 1319 ms | 1076 ms | -18.4% |
| P95 延迟 | 3211 ms | 3015 ms | -6.1% |
| 平均质量分 | 95.52 | 96.56 | +1.04 分 |
| 质量通过率 | 38/48 | 40/48 | +4.2 个百分点 |
| JSON 有效率 | 100% | 100% | 无回归 |
| 平均输出 token | 91.71 | 81.90 | -10.7% |
| 平均 reasoning token | 9.15 | 1.19 | -87.0% |

分模式结果：

| 模式 | A 中位延迟 | B 中位延迟 | 结论 |
| --- | ---: | ---: | --- |
| Auto | 1301 ms | 1065 ms | -18.1%；27 个配对中 26 个更快，证据充分 |
| Concise | 879 ms | 761 ms | -13.4%；9 个配对中 7 个更快，中等置信度 |
| Professional | 1704 ms | 1930 ms | 参数相同，仅作为服务与网络噪声对照，不归因于配置 |

Auto 与 Concise 合并统计的中位延迟为 1230 → 985 ms（-19.9%），平均输出 token 为 77.64 → 55.92（-28.0%），且没有配对质量退化。

## 测试系统输出

真实基准生成：

- `tmp/benchmarks/ab-latest.md`：可读的整体与分模式 A/B 对比。
- `tmp/benchmarks/ab-latest.json`：聚合数据和逐样本指标，便于后续分析。

报告不会记录 API Key、原始 Prompt 或模型输出。逐样本只记录样本 ID、模式、A/B 版本、耗时、usage、质量分数、长度比、finish reason 和安全错误码。

## 上线决定与边界

- Auto 保留 `reasoning_effort: none`、`verbosity: low`。
- Concise 保留 `reasoning_effort: none`、`verbosity: low`，按中等置信度改善处理。
- Professional 保持 `reasoning_effort: low`、API 默认 verbosity。
- Custom 沿用 Auto/Concise 参数映射；当前语料没有 Custom 实时用例，因此仅完成代码级映射验证。
- 该结论仅适用于官方 `gpt-5.6-luna`；DeepSeek、Anthropic、Gemini 和其他兼容服务不会收到这些 OpenAI 专用参数。

候选 B 曾出现一次 12.468 秒的 `analysis-expansion-zh` 尖峰，当前 48 样本 P95 不包含最大的两个值。因此典型延迟改善成立，但不能据此宣称最坏等待时间已经解决。报告不保存模型输出，自动质量门槛也不能替代人工抽查。
