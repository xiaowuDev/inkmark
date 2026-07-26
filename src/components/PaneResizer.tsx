import { useCallback, type PointerEvent } from "react";

interface PaneResizerProps {
  /** 手柄贴在哪一侧的面板上：left 表示左侧栏，right 表示右侧栏。 */
  edge: "left" | "right";
  label: string;
  width: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  onReset: () => void;
}

const KEYBOARD_STEP_PX = 16;

export function PaneResizer({
  edge,
  label,
  width,
  min,
  max,
  onChange,
  onReset,
}: PaneResizerProps) {
  const clamp = useCallback(
    (value: number) => Math.min(Math.max(Math.round(value), min), max),
    [max, min],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-pane");

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      onChange(clamp(startWidth + (edge === "left" ? delta : -delta)));
    };
    const handleUp = () => {
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      handle.removeEventListener("pointercancel", handleUp);
      document.body.classList.remove("is-resizing-pane");
    };

    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleUp);
    handle.addEventListener("pointercancel", handleUp);
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={width}
      className={`pane-resizer is-${edge}`}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const direction =
          event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (direction === 0) {
          return;
        }
        event.preventDefault();
        const step = direction * KEYBOARD_STEP_PX;
        onChange(clamp(width + (edge === "left" ? step : -step)));
      }}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
      title={`拖动调整${label}（双击恢复默认）`}
    />
  );
}
