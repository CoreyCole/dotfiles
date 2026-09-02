import type { Component, TUI } from "@earendil-works/pi-tui";
import type { ExtensionUIContext, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import { FAST_STATUS_KEY } from "./capabilities.ts";
import type { FooterMode } from "./fast-config-store.ts";
import type { FastColorValue } from "./fast-colors.ts";
import type { FastStateTransition, RequestedFastInactiveEvent } from "./fast-state-engine.ts";
import { FastLabelFormatter } from "./fast-label-formatter.ts";
import { FooterClone, type FooterCloneContext, type FooterCloneTheme } from "./footer-clone.ts";

export type FooterFeedbackNoticeType = "info" | "warning" | "error";

export interface FooterFeedbackNotifier {
  notify(message: string, type: FooterFeedbackNoticeType): void;
}

export interface FooterFeedbackSyncOptions {
  context: FooterCloneContext;
  isFastActive: () => boolean;
  getThinkingLevel: () => string | undefined;
  fastLabelColors?: {
    dark?: FastColorValue | undefined;
    light?: FastColorValue | undefined;
    vars: Readonly<Record<string, string>>;
  };
}

type FooterFactory = (
  tui: TUI,
  theme: FooterCloneTheme,
  footerData: ReadonlyFooterDataProvider,
) => Component & { dispose?(): void };

type FooterFeedbackUi = FooterFeedbackNotifier & Partial<Pick<ExtensionUIContext, "setFooter" | "setStatus">>;

export interface FooterFeedbackOptions {
  labelFormatter?: FastLabelFormatter | undefined;
}

export const FAST_REQUESTED_INACTIVE_NO_MODEL_WARNING =
  "Fast Mode is requested but inactive because no model is selected.";
export const FAST_REQUESTED_INACTIVE_UNSUPPORTED_MODEL_WARNING =
  "Fast Mode is requested but inactive because the current model is not supported.";

function requestedInactiveWarningMessage(event: RequestedFastInactiveEvent): string {
  if (event.reason === "no-model") {
    return FAST_REQUESTED_INACTIVE_NO_MODEL_WARNING;
  }

  return FAST_REQUESTED_INACTIVE_UNSUPPORTED_MODEL_WARNING;
}

function canSetFooter(ui: FooterFeedbackUi | undefined): ui is FooterFeedbackUi & Pick<ExtensionUIContext, "setFooter"> {
  return typeof ui?.setFooter === "function";
}

function canSetStatus(ui: FooterFeedbackUi | undefined): ui is FooterFeedbackUi & Pick<ExtensionUIContext, "setStatus"> {
  return typeof ui?.setStatus === "function";
}

class FooterUiStatusState {
  private ownsFastStatus = false;

  publish(ui: FooterFeedbackUi, isActive: boolean): void {
    if (!canSetStatus(ui)) {
      return;
    }

    ui.setStatus(FAST_STATUS_KEY, isActive ? "fast" : undefined);
    this.ownsFastStatus = isActive;
  }

  clearWhenOwned(ui: FooterFeedbackUi): void {
    if (this.ownsFastStatus) {
      publishStatus(ui, false);
    }
  }

  clear(): void {
    this.ownsFastStatus = false;
  }
}

function publishStatus(ui: FooterFeedbackUi, isActive: boolean): void {
  if (!canSetStatus(ui)) {
    return;
  }

  ui.setStatus(FAST_STATUS_KEY, isActive ? "fast" : undefined);
}

/**
 * Feedback seam for Fast Mode lifecycle notices and footer ownership.
 *
 * The state engine owns transition cadence; this class translates narrow
 * transition events into user notifications and owns the replace-mode footer
 * clone installation while syncing status-mode UI.
 */
export class FooterFeedback {
  private readonly labelFormatter: FastLabelFormatter;
  private latestSyncOptions: FooterFeedbackSyncOptions | undefined;
  private installedReplaceFooter: FooterClone | undefined;
  private readonly statusState = new FooterUiStatusState();

  constructor(options: FooterFeedbackOptions = {}) {
    this.labelFormatter = options.labelFormatter ?? new FastLabelFormatter();
  }

  syncFooterMode(mode: FooterMode, ui: FooterFeedbackUi | undefined, options?: FooterFeedbackSyncOptions): void {
    if (options) {
      this.latestSyncOptions = options;
    }

    if (!canSetFooter(ui) && !canSetStatus(ui)) {
      return;
    }

    const shouldShowStatus = mode === "status" && this.latestSyncOptions?.isFastActive() === true;

    if (canSetStatus(ui)) {
      this.statusState.publish(ui, shouldShowStatus);
    }

    // Synchronize status indicator for all modes (status mode when active, otherwise clear).
    if (mode !== "replace") {
      this.clearFooterIfOwned(ui);
      return;
    }

    if (this.installedReplaceFooter) {
      if (!this.installedReplaceFooter.isOwnedByExtension()) {
        this.installedReplaceFooter = undefined;
      } else {
        this.installedReplaceFooter.invalidate();
        return;
      }
    }

    if (!this.latestSyncOptions || !canSetFooter(ui)) {
      return;
    }

    const factory: FooterFactory = (tui, theme, footerData) => {
      const footer = new FooterClone({
        getContext: () => this.latestSyncOptions?.context,
        footerData,
        theme,
        labelFormatter: this.labelFormatter,
        isFastActive: () => this.latestSyncOptions?.isFastActive() === true,
        getThinkingLevel: () => this.latestSyncOptions?.getThinkingLevel(),
        fastLabelColors: this.latestSyncOptions?.fastLabelColors,
        tui,
      });
      this.installedReplaceFooter = footer;
      return footer;
    };

    ui.setFooter(factory);
  }

  cleanup(ui: FooterFeedbackUi | undefined): void {
    this.clearFooterIfOwned(ui);
    if (ui !== undefined) {
      this.statusState.clearWhenOwned(ui);
    }

    this.statusState.clear();
  }

  private clearFooterIfOwned(ui: FooterFeedbackUi | undefined): void {
    if (!this.installedReplaceFooter) {
      return;
    }

    if (!this.installedReplaceFooter.isOwnedByExtension()) {
      this.installedReplaceFooter = undefined;
      return;
    }

    this.installedReplaceFooter.dispose();

    if (canSetFooter(ui)) {
      ui.setFooter(undefined);
    }

    this.installedReplaceFooter = undefined;
  }

  notifyForTransition(transition: FastStateTransition, notifier: FooterFeedbackNotifier | undefined): void {
    if (notifier === undefined) {
      return;
    }

    for (const event of transition.events) {
      if (event.kind === "requested-fast-inactive") {
        notifier.notify(requestedInactiveWarningMessage(event), "warning");
      }
    }
  }
}
