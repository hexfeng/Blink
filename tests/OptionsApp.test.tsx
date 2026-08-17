import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "../entrypoints/options/OptionsApp";

vi.mock("wxt/browser", () => ({ browser: { i18n: { getUILanguage: () => "en" } } }));

beforeEach(() => {
  vi.spyOn(globalThis.chrome.i18n, "getUILanguage").mockReturnValue("en");
});

describe("options model and site catalogs", () => {
  it("selects a curated model and keeps custom model IDs editable", async () => {
    const user = userEvent.setup();
    render(<OptionsApp demo />);
    const model = screen.getByRole("combobox", { name: "Model" });

    expect((model as HTMLInputElement).value).toBe("gpt-5.6-luna");
    await user.click(model);
    await user.click(screen.getByRole("option", { name: /GPT-5.6 Terra/ }));
    expect((model as HTMLInputElement).value).toBe("gpt-5.6-terra");

    await user.clear(model);
    await user.type(model, "provider/custom-model");
    expect(screen.getByRole("option", { name: /provider\/custom-model/ }).getAttribute("aria-selected")).toBe("true");
    expect((model as HTMLInputElement).value).toBe("provider/custom-model");
    expect(screen.getByRole("option", { name: "Anthropic · Preview" })).toBeTruthy();
    expect(screen.getByText(/chat website and model provider are independent/i)).toBeTruthy();
  });

  it("filters the site catalog and updates the enabled count", async () => {
    const user = userEvent.setup();
    render(<OptionsApp demo />);

    expect(screen.getByText("3 enabled")).toBeTruthy();
    expect(screen.getByText("ChatGPT")).toBeTruthy();
    expect(screen.queryByText("Grok")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Experimental" }));
    expect(screen.getByText("Grok")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Qwen: Site allowed" }));
    expect(screen.getByText("4 enabled")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Enabled" }));
    expect(screen.getByText("ChatGPT")).toBeTruthy();
    expect(screen.queryByText("Grok")).toBeNull();
    expect(screen.getByText("Qwen")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Experimental" }));
    await user.type(screen.getByRole("searchbox", { name: "Search sites" }), "deepseek");
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText("DeepSeek")).toBeTruthy();
  });
});
