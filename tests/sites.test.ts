import { describe, expect, it } from "vitest";
import { SITES, findSiteByUrl } from "../src/lib/sites";

describe("site catalog", () => {
  it.each([
    ["https://www.kimi.com/", "kimi"],
    ["https://chat.z.ai/", "glm"],
    ["https://www.doubao.com/", "doubao"],
    ["https://www.perplexity.ai/", "perplexity"]
  ])("matches the production redirect %s", (url, expectedId) => {
    expect(findSiteByUrl(url)?.id).toBe(expectedId);
  });

  it("keeps currently testable Meta AI pending and records observed blockers", () => {
    expect(SITES.find((site) => site.id === "meta")?.verificationStatus).toBe("pendingVerification");
    expect(SITES.filter((site) => ["deepseek", "doubao", "mistral", "yuanbao"].includes(site.id)).every((site) => site.verificationStatus === "externalBlocked")).toBe(true);
  });

  it("records user-verified reference sites without promoting partial site checks", () => {
    expect(SITES.filter((site) => site.verificationStatus === "verified").map((site) => site.id)).toEqual(["chatgpt", "gemini", "claude"]);
    expect(SITES.filter((site) => ["grok", "qwen", "minimax", "kimi", "glm", "copilot", "perplexity"].includes(site.id)).every((site) => site.verificationStatus === "pendingVerification")).toBe(true);
  });
});
