import { useEffect, useState } from "react";

/** 与 app.css 抽屉断点保持一致。 */
const COMPACT_QUERY =
  "(max-width: 720px), (pointer: coarse) and (max-width: 900px)";

/** 侧栏与 AI 面板改为覆盖式抽屉的紧凑布局（手机、平板竖屏、窄窗口）。 */
export function useCompactLayout(): boolean {
  const [isCompact, setIsCompact] = useState(
    () => window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  return isCompact;
}
