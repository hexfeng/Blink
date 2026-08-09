import { extractUrls } from "./prompts";
import type { BuiltinModeId } from "./types";
import type { BenchmarkVariant, ProviderUsage } from "./providers";

export interface QualityGates {
  requiredLiterals?: string[];
  requiredAny?: string[][];
  forbiddenLiterals?: string[];
  minLengthRatio?: number;
  maxLengthRatio?: number;
  requireStructure?: boolean;
}

export interface PromptBenchmarkCase {
  id: string;
  mode: BuiltinModeId;
  input: string;
  expectation?: string;
  qualityGates?: QualityGates;
}

export interface QualityCheck {
  name: string;
  passed: boolean;
}

export interface QualityEvaluation {
  score: number;
  passed: boolean;
  outputCharacters: number;
  lengthRatio: number;
  checks: QualityCheck[];
}

export interface BenchmarkSample {
  caseId: string;
  mode: BuiltinModeId;
  variant: BenchmarkVariant;
  success: boolean;
  durationMs: number;
  jsonValid: boolean;
  qualityScore?: number;
  qualityPassed?: boolean;
  outputCharacters?: number;
  lengthRatio?: number;
  usage?: ProviderUsage;
  finishReason?: string;
  errorCode?: string;
}

export interface BenchmarkSummary {
  variant: BenchmarkVariant;
  samples: number;
  successful: number;
  medianLatencyMs?: number;
  p95LatencyMs?: number;
  meanQualityScore?: number;
  qualityPassRate?: number;
  jsonValidRate: number;
  meanLengthRatio?: number;
  meanInputTokens?: number;
  meanOutputTokens?: number;
  meanTotalTokens?: number;
  meanReasoningTokens?: number;
  meanCachedInputTokens?: number;
}

const NUMBER_PATTERN = /(?:[$€£¥￥]\s*)?\d[\d,.]*(?:\s*(?:%|元|人|周|天|字|个月|年))?/gu;
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/gu;
const QUOTED_PATTERN = /“[^”]+”|"[^"]+"|'[^']+'/gu;

function multiset(values: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function containsMultiset(input: string[], output: string[]): boolean {
  const available = multiset(output);
  for (const value of input) {
    const count = available.get(value) ?? 0;
    if (!count) return false;
    if (count === 1) available.delete(value);
    else available.set(value, count - 1);
  }
  return true;
}

function matches(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0]);
}

function addPreservationCheck(checks: QualityCheck[], name: string, inputValues: string[], outputValues: string[]): void {
  if (inputValues.length) checks.push({ name, passed: containsMultiset(inputValues, outputValues) });
}

export function evaluateOptimization(testCase: PromptBenchmarkCase, optimized: string): QualityEvaluation {
  const checks: QualityCheck[] = [{ name: "non-empty", passed: optimized.trim().length > 0 }];
  const ratio = testCase.input.length ? optimized.length / testCase.input.length : 0;

  addPreservationCheck(checks, "preserve-urls", extractUrls(testCase.input), extractUrls(optimized));
  addPreservationCheck(checks, "preserve-numbers", matches(testCase.input, NUMBER_PATTERN), matches(optimized, NUMBER_PATTERN));
  addPreservationCheck(checks, "preserve-code-blocks", matches(testCase.input, CODE_BLOCK_PATTERN), matches(optimized, CODE_BLOCK_PATTERN));
  addPreservationCheck(checks, "preserve-quoted-text", matches(testCase.input, QUOTED_PATTERN), matches(optimized, QUOTED_PATTERN));

  const gates = testCase.qualityGates;
  for (const literal of gates?.requiredLiterals ?? []) checks.push({ name: `required:${literal}`, passed: optimized.includes(literal) });
  for (const [index, group] of (gates?.requiredAny ?? []).entries()) {
    checks.push({ name: `required-any:${index + 1}`, passed: group.some((literal) => optimized.toLocaleLowerCase().includes(literal.toLocaleLowerCase())) });
  }
  for (const literal of gates?.forbiddenLiterals ?? []) checks.push({ name: `forbidden:${literal}`, passed: !optimized.includes(literal) });
  if (gates?.minLengthRatio !== undefined) checks.push({ name: "minimum-length-ratio", passed: ratio >= gates.minLengthRatio });
  if (gates?.maxLengthRatio !== undefined) checks.push({ name: "maximum-length-ratio", passed: ratio <= gates.maxLengthRatio });
  if (gates?.requireStructure) checks.push({ name: "structured-output", passed: /\n\s*(?:#{1,3}\s|[-*]\s|\d+[.)]\s)/u.test(optimized) });

  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    score: Math.round((passedChecks / checks.length) * 100),
    passed: passedChecks === checks.length,
    outputCharacters: optimized.length,
    lengthRatio: Number(ratio.toFixed(3)),
    checks
  };
}

function percentile(values: number[], quantile: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function rounded(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Number(value.toFixed(2));
}

export function summarizeBenchmark(samples: BenchmarkSample[], variant: BenchmarkVariant): BenchmarkSummary {
  const selected = samples.filter((sample) => sample.variant === variant);
  const successful = selected.filter((sample) => sample.success);
  const qualityScores = successful.flatMap((sample) => sample.qualityScore === undefined ? [] : [sample.qualityScore]);
  const qualityPasses = successful.flatMap((sample) => sample.qualityPassed === undefined ? [] : [sample.qualityPassed ? 1 : 0]);
  const lengthRatios = successful.flatMap((sample) => sample.lengthRatio === undefined ? [] : [sample.lengthRatio]);
  const usageValues = (field: keyof ProviderUsage) => successful.flatMap((sample) => sample.usage?.[field] === undefined ? [] : [sample.usage[field]] as number[]);
  const medianLatencyMs = percentile(successful.map((sample) => sample.durationMs), 0.5);
  const p95LatencyMs = percentile(successful.map((sample) => sample.durationMs), 0.95);
  const meanQualityScore = rounded(mean(qualityScores));
  const qualityPassRate = rounded(mean(qualityPasses));
  const meanLengthRatio = rounded(mean(lengthRatios));
  const meanInputTokens = rounded(mean(usageValues("inputTokens")));
  const meanOutputTokens = rounded(mean(usageValues("outputTokens")));
  const meanTotalTokens = rounded(mean(usageValues("totalTokens")));
  const meanReasoningTokens = rounded(mean(usageValues("reasoningTokens")));
  const meanCachedInputTokens = rounded(mean(usageValues("cachedInputTokens")));

  return {
    variant,
    samples: selected.length,
    successful: successful.length,
    ...(medianLatencyMs !== undefined ? { medianLatencyMs } : {}),
    ...(p95LatencyMs !== undefined ? { p95LatencyMs } : {}),
    ...(meanQualityScore !== undefined ? { meanQualityScore } : {}),
    ...(qualityPassRate !== undefined ? { qualityPassRate } : {}),
    jsonValidRate: selected.length ? Number((selected.filter((sample) => sample.jsonValid).length / selected.length).toFixed(2)) : 0,
    ...(meanLengthRatio !== undefined ? { meanLengthRatio } : {}),
    ...(meanInputTokens !== undefined ? { meanInputTokens } : {}),
    ...(meanOutputTokens !== undefined ? { meanOutputTokens } : {}),
    ...(meanTotalTokens !== undefined ? { meanTotalTokens } : {}),
    ...(meanReasoningTokens !== undefined ? { meanReasoningTokens } : {}),
    ...(meanCachedInputTokens !== undefined ? { meanCachedInputTokens } : {})
  };
}
