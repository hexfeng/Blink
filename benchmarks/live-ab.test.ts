import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateOptimization, summarizeBenchmark, type BenchmarkSample, type PromptBenchmarkCase } from "../src/lib/benchmark";
import { openAiTuningForMode, ProviderFailure, requestProviderDetailed, type BenchmarkVariant } from "../src/lib/providers";
import { buildProviderPrompt, parseOptimizedJson, parseOptimizedResponse } from "../src/lib/prompts";
import type { BuiltinModeId, ModeSelection, ProviderConfig } from "../src/lib/types";

const REPORT_DIRECTORY = resolve("tmp/benchmarks");

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}`);
  return value;
}

async function loadCases(): Promise<PromptBenchmarkCase[]> {
  const raw = await readFile(resolve("docs/PROMPT_CORPUS.json"), "utf8");
  return JSON.parse(raw) as PromptBenchmarkCase[];
}

async function runSample(config: ProviderConfig, testCase: PromptBenchmarkCase, variant: BenchmarkVariant): Promise<BenchmarkSample> {
  const startedAt = Date.now();
  const mode: ModeSelection = { type: "builtin", id: testCase.mode };
  const prompt = buildProviderPrompt(testCase.input, mode, []);
  try {
    const result = await requestProviderDetailed(config, {
      ...prompt,
      requireOptimizedPromptJson: true,
      openAiTuning: openAiTuningForMode(mode, variant)
    });
    let optimized: string;
    try {
      parseOptimizedJson(result.text);
    } catch {
      return {
        caseId: testCase.id,
        mode: testCase.mode,
        variant,
        success: false,
        durationMs: result.durationMs,
        jsonValid: false,
        ...(result.usage ? { usage: result.usage } : {}),
        ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        errorCode: "INVALID_RESPONSE"
      };
    }
    try {
      optimized = parseOptimizedResponse(result.text, testCase.input);
    } catch {
      return {
        caseId: testCase.id,
        mode: testCase.mode,
        variant,
        success: false,
        durationMs: result.durationMs,
        jsonValid: true,
        ...(result.usage ? { usage: result.usage } : {}),
        ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        errorCode: "SAFETY_VALIDATION_FAILED"
      };
    }
    const quality = evaluateOptimization(testCase, optimized);
    return {
      caseId: testCase.id,
      mode: testCase.mode,
      variant,
      success: true,
      durationMs: result.durationMs,
      jsonValid: true,
      qualityScore: quality.score,
      qualityPassed: quality.passed,
      outputCharacters: quality.outputCharacters,
      lengthRatio: quality.lengthRatio,
      ...(result.usage ? { usage: result.usage } : {}),
      ...(result.finishReason ? { finishReason: result.finishReason } : {})
    };
  } catch (error) {
    return {
      caseId: testCase.id,
      mode: testCase.mode,
      variant,
      success: false,
      durationMs: Date.now() - startedAt,
      jsonValid: false,
      errorCode: error instanceof ProviderFailure ? error.safeError.code : "BENCHMARK_ERROR"
    };
  }
}

type VariantSummary = ReturnType<typeof summarizeBenchmark>;
type ModeSummaries = Record<BuiltinModeId, { baseline: VariantSummary; candidate: VariantSummary }>;

function percentageDelta(baseline: number | undefined, candidate: number | undefined): string {
  if (baseline === undefined || candidate === undefined || baseline === 0) return "n/a";
  return `${(((candidate - baseline) / baseline) * 100).toFixed(1)}%`;
}

function markdownReport(model: string, runs: number, baseline: VariantSummary, candidate: VariantSummary, byMode: ModeSummaries): string {
  const modeRows = (Object.entries(byMode) as Array<[BuiltinModeId, ModeSummaries[BuiltinModeId]]>).map(([mode, summaries]) =>
    `| ${mode} | ${summaries.baseline.medianLatencyMs ?? "n/a"} | ${summaries.candidate.medianLatencyMs ?? "n/a"} | ${percentageDelta(summaries.baseline.medianLatencyMs, summaries.candidate.medianLatencyMs)} | ${summaries.baseline.meanQualityScore ?? "n/a"} | ${summaries.candidate.meanQualityScore ?? "n/a"} |`
  ).join("\n");
  return `# Blink Prompt A/B Benchmark

- Generated: ${new Date().toISOString()}
- Model: ${model}
- Runs per case: ${runs}
- Raw prompts and model outputs: not recorded

| Metric | Baseline A | Candidate B | B vs A |
| --- | ---: | ---: | ---: |
| Successful samples | ${baseline.successful}/${baseline.samples} | ${candidate.successful}/${candidate.samples} | — |
| Median latency (ms) | ${baseline.medianLatencyMs ?? "n/a"} | ${candidate.medianLatencyMs ?? "n/a"} | ${percentageDelta(baseline.medianLatencyMs, candidate.medianLatencyMs)} |
| P95 latency (ms) | ${baseline.p95LatencyMs ?? "n/a"} | ${candidate.p95LatencyMs ?? "n/a"} | ${percentageDelta(baseline.p95LatencyMs, candidate.p95LatencyMs)} |
| Mean quality score | ${baseline.meanQualityScore ?? "n/a"} | ${candidate.meanQualityScore ?? "n/a"} | ${percentageDelta(baseline.meanQualityScore, candidate.meanQualityScore)} |
| Quality pass rate | ${baseline.qualityPassRate ?? "n/a"} | ${candidate.qualityPassRate ?? "n/a"} | ${percentageDelta(baseline.qualityPassRate, candidate.qualityPassRate)} |
| JSON valid rate | ${baseline.jsonValidRate} | ${candidate.jsonValidRate} | ${percentageDelta(baseline.jsonValidRate, candidate.jsonValidRate)} |
| Mean output/input length | ${baseline.meanLengthRatio ?? "n/a"} | ${candidate.meanLengthRatio ?? "n/a"} | ${percentageDelta(baseline.meanLengthRatio, candidate.meanLengthRatio)} |
| Mean output tokens | ${baseline.meanOutputTokens ?? "n/a"} | ${candidate.meanOutputTokens ?? "n/a"} | ${percentageDelta(baseline.meanOutputTokens, candidate.meanOutputTokens)} |
| Mean total tokens | ${baseline.meanTotalTokens ?? "n/a"} | ${candidate.meanTotalTokens ?? "n/a"} | ${percentageDelta(baseline.meanTotalTokens, candidate.meanTotalTokens)} |
| Mean reasoning tokens | ${baseline.meanReasoningTokens ?? "n/a"} | ${candidate.meanReasoningTokens ?? "n/a"} | ${percentageDelta(baseline.meanReasoningTokens, candidate.meanReasoningTokens)} |

## By mode

| Mode | A median ms | B median ms | B vs A | A quality | B quality |
| --- | ---: | ---: | ---: | ---: | ---: |
${modeRows}
`;
}

describe("live OpenAI Luna A/B benchmark", () => {
  it("compares the current baseline with the candidate tuning", async () => {
    const apiKey = process.env.BLINK_BENCHMARK_API_KEY?.trim();
    if (!apiKey) throw new Error("BLINK_BENCHMARK_API_KEY is required; the benchmark never writes or prints it");

    const model = process.env.BLINK_BENCHMARK_MODEL?.trim() || "gpt-5.6-luna";
    if (model !== "gpt-5.6-luna") throw new Error("This benchmark currently supports only gpt-5.6-luna");
    const runs = positiveInteger("BLINK_BENCHMARK_RUNS", 1, 5);
    const allCases = await loadCases();
    const caseLimit = positiveInteger("BLINK_BENCHMARK_CASE_LIMIT", allCases.length, allCases.length);
    const cases = allCases.slice(0, caseLimit);
    const config: ProviderConfig = { schemaVersion: 1, kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", apiKey, model };
    const samples: BenchmarkSample[] = [];

    for (let run = 0; run < runs; run += 1) {
      for (const [index, testCase] of cases.entries()) {
        const variants: BenchmarkVariant[] = (run + index) % 2 === 0 ? ["baseline", "candidate"] : ["candidate", "baseline"];
        for (const variant of variants) samples.push(await runSample(config, testCase, variant));
      }
    }

    const baseline = summarizeBenchmark(samples, "baseline");
    const candidate = summarizeBenchmark(samples, "candidate");
    const byMode = Object.fromEntries((["auto", "concise", "professional"] satisfies BuiltinModeId[]).map((mode) => {
      const modeSamples = samples.filter((sample) => sample.mode === mode);
      return [mode, { baseline: summarizeBenchmark(modeSamples, "baseline"), candidate: summarizeBenchmark(modeSamples, "candidate") }];
    })) as ModeSummaries;
    const report = { generatedAt: new Date().toISOString(), model, runs, cases: cases.length, baseline, candidate, byMode, samples };
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(resolve(REPORT_DIRECTORY, "ab-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(resolve(REPORT_DIRECTORY, "ab-latest.md"), markdownReport(model, runs, baseline, candidate, byMode), "utf8");

    process.stdout.write(`\nA/B report: ${resolve(REPORT_DIRECTORY, "ab-latest.md")}\n`);
    expect(baseline.samples).toBe(cases.length * runs);
    expect(candidate.samples).toBe(cases.length * runs);
  });
});
