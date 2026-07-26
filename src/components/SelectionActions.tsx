import { useEffect, useRef, useState, type RefObject } from "react";

import {
  SELECTION_ACTIONS,
  type SelectionAction,
} from "../ai/selection-actions";
import { Icon } from "./Icon";

const MIN_SELECTION_LENGTH = 2;
const MAX_SELECTION_LENGTH = 20_000;
const BAR_OFFSET_PX = 10;

interface SelectionRect {
  left: number;
  top: number;
}

interface SelectionActionsProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onAction: (action: SelectionAction, selection: string) => void;
}

function readEditorSelection(container: HTMLElement | null): {
  text: string;
  rect: SelectionRect;
} | null {
  const selection = window.getSelection();
  if (
    !container ||
    !selection ||
    selection.isCollapsed ||
    !selection.rangeCount
  ) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }
  const text = selection.toString().trim();
  if (
    text.length < MIN_SELECTION_LENGTH ||
    text.length > MAX_SELECTION_LENGTH
  ) {
    return null;
  }
  const bounds = range.getBoundingClientRect();
  if (bounds.width === 0 && bounds.height === 0) {
    return null;
  }
  return {
    text,
    rect: {
      left: bounds.left + bounds.width / 2,
      top: bounds.top - BAR_OFFSET_PX,
    },
  };
}

export function SelectionActions({
  containerRef,
  onAction,
}: SelectionActionsProps) {
  const [state, setState] = useState<{
    text: string;
    rect: SelectionRect;
  } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = (event: Event) => {
      // 点工具条本身时保持当前选区，否则按钮还没触发就先消失了。
      if (
        event.target instanceof Node &&
        barRef.current?.contains(event.target)
      ) {
        return;
      }
      setState(readEditorSelection(containerRef.current));
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setState(null);
        return;
      }
      if (event.shiftKey || event.metaKey) {
        refresh(event);
      }
    };

    document.addEventListener("pointerup", refresh);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("pointerup", refresh);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [containerRef]);

  if (!state) {
    return null;
  }

  return (
    <div
      className="selection-actions"
      ref={barRef}
      style={{
        left: `${String(state.rect.left)}px`,
        top: `${String(state.rect.top)}px`,
      }}
    >
      <span className="selection-actions-mark">
        <Icon name="ai" />
      </span>
      {SELECTION_ACTIONS.map((action) => (
        <button
          key={action.key}
          onClick={() => {
            onAction(action, state.text);
            setState(null);
          }}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
