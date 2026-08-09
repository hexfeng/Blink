import { describe, expect, it } from "vitest";
import corpus from "../docs/PROMPT_CORPUS.json";
import { evaluateOptimization, summarizeBenchmark, type BenchmarkSample, type PromptBenchmarkCase } from "../src/lib/benchmark";

describe("prompt benchmark metrics", () => {
  it("keeps the benchmark corpus unique and evaluable", () => {
    const cases = corpus as PromptBenchmarkCase[];
    expect(cases).toHaveLength(16);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
    expect(cases.every((testCase) => ["auto", "concise", "professional"].includes(testCase.mode))).toBe(true);
  });

  it("scores preservation, case-specific quality gates, and output length", () => {
    const testCase: PromptBenchmarkCase = {
      id: "structured-plan",
      mode: "professional",
      input: "为 5 人制定计划，预算 $2,400，参考 https://example.com/a。",
      qualityGates: {
        requiredAny: [["风险", "限制"]],
        requireStructure: true,
        minLengthRatio: 1
      }
    };
    const result = evaluateOptimization(testCase, [
      "制定一份面向 5 人的执行计划，预算为 $2,400，并参考 https://example.com/a。",
      "",
      "## 风险",
      "- 说明关键限制。"
    ].join("\n"));

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.lengthRatio).toBeGreaterThan(1);
    expect(result.checks.map((check) => check.name)).toEqual([
      "non-empty",
      "preserve-urls",
      "preserve-numbers",
      "required-any:1",
      "minimum-length-ratio",
      "structured-output"
    ]);
  });

  it("detects dropped protected content and failed gates", () => {
    const result = evaluateOptimization({
      id: "lossy",
      mode: "concise",
      input: "保留原句“Ship small, learn fast.”，日期 2026-08-08。",
      qualityGates: { requiredLiterals: ["2026-08-08"], maxLengthRatio: 1 }
    }, "写得更简洁。");

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.name)).toEqual([
      "preserve-numbers",
      "preserve-quoted-text",
      "required:2026-08-08"
    ]);
  });

  it("summarizes paired latency, quality, validity, length, and usage", () => {
    const samples: BenchmarkSample[] = [
      { caseId: "1", mode: "auto", variant: "baseline", success: true, durationMs: 400, jsonValid: true, qualityScore: 80, qualityPassed: true, lengthRatio: 2, usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, reasoningTokens: 20, cachedInputTokens: 10 } },
      { caseId: "2", mode: "auto", variant: "baseline", success: true, durationMs: 600, jsonValid: true, qualityScore: 60, qualityPassed: false, lengthRatio: 3, usage: { inputTokens: 120, outputTokens: 70, totalTokens: 190, reasoningTokens: 30, cachedInputTokens: 0 } },
      { caseId: "1", mode: "auto", variant: "candidate", success: true, durationMs: 200, jsonValid: true, qualityScore: 80, qualityPassed: true, lengthRatio: 1.5, usage: { inputTokens: 100, outputTokens: 35, totalTokens: 135, reasoningTokens: 0, cachedInputTokens: 10 } },
      { caseId: "2", mode: "auto", variant: "candidate", success: false, durationMs: 250, jsonValid: false, errorCode: "INVALID_RESPONSE" }
    ];

    expect(summarizeBenchmark(samples, "baseline")).toEqual({
      variant: "baseline",
      samples: 2,
      successful: 2,
      medianLatencyMs: 400,
      p95LatencyMs: 600,
      meanQualityScore: 70,
      qualityPassRate: 0.5,
      jsonValidRate: 1,
      meanLengthRatio: 2.5,
      meanInputTokens: 110,
      meanOutputTokens: 60,
      meanTotalTokens: 170,
      meanReasoningTokens: 25,
      meanCachedInputTokens: 5
    });
    expect(summarizeBenchmark(samples, "candidate")).toMatchObject({
      samples: 2,
      successful: 1,
      medianLatencyMs: 200,
      jsonValidRate: 0.5,
      meanReasoningTokens: 0
    });
  });
});
