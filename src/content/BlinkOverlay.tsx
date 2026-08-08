import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowCounterClockwise, CaretDown, CheckCircle, Copy, Gear, Scissors, Sparkle, SpinnerGap, Target, WarningCircle } from "@phosphor-icons/react";
import { ERROR_MESSAGE_KEYS } from "../lib/errors";
import { createTranslator, type Locale, type MessageKey } from "../lib/i18n";
import type { BuiltinModeId } from "../lib/types";
import type { BlinkController, OverlayState } from "./controller";

interface Props {
  controller: BlinkController;
  state: OverlayState;
  locale?: Locale;
}

const builtinIds: BuiltinModeId[] = ["auto", "concise", "professional"];

export function BlinkOverlay({ controller, state, locale }: Props) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  const menuRef = useRef<HTMLDivElement>(null);
  const modeItems = [
    ...builtinIds.map((id) => ({ id, label: t(id), description: t(`${id}Description` as MessageKey) })),
    ...state.settings.customModes.map((mode) => ({ id: mode.id, label: mode.name, description: mode.instruction }))
  ];
  const activeMode = modeItems.find((item) => item.id === state.settings.activeModeId) ?? modeItems[0];

  useEffect(() => {
    if (!state.menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus();
  }, [state.menuOpen]);

  if (!state.visible) return null;

  const localKey: Record<NonNullable<OverlayState["localMessage"]>, MessageKey> = {
    empty: "emptyDraft",
    tooLong: "inputTooLong",
    draftChanged: "draftChanged",
    copied: "copied"
  };
  const message = state.localMessage
    ? t(localKey[state.localMessage])
    : state.errorCode
      ? t(ERROR_MESSAGE_KEYS[state.errorCode])
      : undefined;
  const settingsError = state.errorCode === "PROVIDER_NOT_CONFIGURED" || state.errorCode === "HOST_PERMISSION_REQUIRED";

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      controller.setMenuOpen(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    buttons[(current + offset + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div
      className="blink-stage"
      onPointerEnter={() => controller.setOverlayActive(true)}
      onPointerLeave={() => controller.setOverlayActive(false)}
      onFocusCapture={() => controller.setOverlayActive(true)}
      onBlurCapture={() => controller.setOverlayActive(false)}
    >
      <div className="blink-floating">
        {state.menuOpen ? (
          <div className="blink-menu" role="menu" ref={menuRef} onKeyDown={handleMenuKeyDown} aria-label={t("optimizationModes")}>
            {modeItems.map((item, index) => {
              const Icon = index === 1 ? Scissors : index === 2 ? Target : Sparkle;
              return (
                <button
                  type="button"
                  className="blink-mode-item"
                  role="menuitemradio"
                  aria-checked={item.id === state.settings.activeModeId}
                  key={item.id}
                  onClick={() => void controller.selectMode(item.id)}
                >
                  <Icon size={18} weight="regular" aria-hidden="true" />
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  {item.id === state.settings.activeModeId ? <CheckCircle size={17} weight="fill" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {state.phase === "loading" ? (
          <div className="blink-feedback blink-feedback--info" aria-live="polite">
            <SpinnerGap className="blink-spinner" size={17} aria-hidden="true" /> {t("optimizing")}
          </div>
        ) : null}
        {state.phase === "same" ? (
          <div className="blink-feedback blink-feedback--info" aria-live="polite">
            <CheckCircle size={17} aria-hidden="true" /> {state.localMessage === "copied" ? t("copied") : t("sameResult")}
          </div>
        ) : null}
        {state.phase === "error" ? (
          <div className="blink-feedback blink-feedback--error" aria-live="polite">
            <WarningCircle size={17} weight="fill" aria-hidden="true" />
            <span>{message}</span>
            {settingsError ? <button type="button" onClick={() => controller.openSettings()}><Gear size={15} aria-hidden="true" />{t("openSettings")}</button> : null}
          </div>
        ) : null}
        {state.phase === "recovery" ? (
          <div className="blink-recovery" role="alert">
            <div><WarningCircle size={18} weight="fill" aria-hidden="true" /><strong>{t("cannotRestore")}</strong></div>
            <div className="blink-recovery-actions">
              <button type="button" onClick={() => controller.restoreOriginal()}><ArrowCounterClockwise size={15} aria-hidden="true" />{t("restoreInput")}</button>
              <button type="button" onClick={() => void controller.copyOriginal()}><Copy size={15} aria-hidden="true" />{t("copyOriginal")}</button>
            </div>
          </div>
        ) : null}

        <div className={`blink-pill${state.phase === "loading" ? " blink-pill--disabled" : ""}${state.phase === "success" ? " blink-pill--success" : ""}`}>
          {state.phase === "success" ? (
            <>
              <div className="blink-success-label" aria-live="polite">
                <CheckCircle size={18} weight="regular" aria-hidden="true" />
                <span>{t("optimized")}</span>
              </div>
              <button type="button" className="blink-undo" onClick={() => controller.undoLast()}>{t("undo")}</button>
            </>
          ) : (
            <>
              <button type="button" className="blink-primary" onClick={() => void controller.optimize()} disabled={state.phase === "loading"}>
                <Sparkle size={18} weight="fill" aria-hidden="true" />
                <span>Blink</span>
              </button>
              <button
                type="button"
                className="blink-mode-trigger"
                aria-haspopup="menu"
                aria-expanded={state.menuOpen}
                onClick={() => controller.setMenuOpen(!state.menuOpen)}
                disabled={state.phase === "loading"}
              >
                <span>{activeMode?.label ?? t("auto")}</span>
                <CaretDown size={15} weight="bold" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
