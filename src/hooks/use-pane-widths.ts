import { useCallback, useState } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 272;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 520;
export const AI_PANEL_DEFAULT_WIDTH = 382;
export const AI_PANEL_MIN_WIDTH = 300;
export const AI_PANEL_MAX_WIDTH = 720;

const STORAGE_KEY = "inkmark.layout.paneWidths.v1";

interface PaneWidths {
  sidebar: number;
  aiPanel: number;
}

const DEFAULT_WIDTHS: PaneWidths = {
  sidebar: SIDEBAR_DEFAULT_WIDTH,
  aiPanel: AI_PANEL_DEFAULT_WIDTH,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function loadWidths(): PaneWidths {
  const serialized = localStorage.getItem(STORAGE_KEY);
  if (!serialized) {
    return DEFAULT_WIDTHS;
  }
  try {
    const stored = JSON.parse(serialized) as Partial<PaneWidths>;
    return {
      sidebar:
        typeof stored.sidebar === "number"
          ? clamp(stored.sidebar, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
          : SIDEBAR_DEFAULT_WIDTH,
      aiPanel:
        typeof stored.aiPanel === "number"
          ? clamp(stored.aiPanel, AI_PANEL_MIN_WIDTH, AI_PANEL_MAX_WIDTH)
          : AI_PANEL_DEFAULT_WIDTH,
    };
  } catch {
    return DEFAULT_WIDTHS;
  }
}

function persistWidths(widths: PaneWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // 存储不可用时仅影响下次启动的记忆，不该中断拖拽。
  }
}

export function usePaneWidths() {
  const [widths, setWidths] = useState<PaneWidths>(loadWidths);

  const update = useCallback((key: keyof PaneWidths, width: number) => {
    setWidths((current) => {
      const next = { ...current, [key]: width };
      persistWidths(next);
      return next;
    });
  }, []);

  const setSidebarWidth = useCallback(
    (width: number) => {
      update("sidebar", width);
    },
    [update],
  );

  const setAiPanelWidth = useCallback(
    (width: number) => {
      update("aiPanel", width);
    },
    [update],
  );

  const resetSidebarWidth = useCallback(() => {
    update("sidebar", SIDEBAR_DEFAULT_WIDTH);
  }, [update]);

  const resetAiPanelWidth = useCallback(() => {
    update("aiPanel", AI_PANEL_DEFAULT_WIDTH);
  }, [update]);

  return {
    aiPanelWidth: widths.aiPanel,
    resetAiPanelWidth,
    resetSidebarWidth,
    setAiPanelWidth,
    setSidebarWidth,
    sidebarWidth: widths.sidebar,
  };
}
