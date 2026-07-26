import type { SVGProps } from "react";

export type IconName =
  | "ai"
  | "chat"
  | "chevron"
  | "check"
  | "close"
  | "document"
  | "export"
  | "folder"
  | "folderOpen"
  | "graph"
  | "key"
  | "new"
  | "open"
  | "refresh"
  | "save"
  | "send"
  | "settings"
  | "sidebar"
  | "trash";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const ICON_PATHS: Record<IconName, string[]> = {
  ai: [
    "m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9z",
    "m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z",
    "M5 15.5v3",
    "M3.5 17h3",
  ],
  chat: ["M4 4.5h16v11H9l-5 4z"],
  chevron: ["m9 18 6-6-6-6"],
  check: ["m5 12.5 4.2 4L19 7"],
  close: ["m7 7 10 10", "M17 7 7 17"],
  document: [
    "M6.5 3.5h7l4 4v13h-11z",
    "M13.5 3.5v4h4",
    "M9.5 12h5",
    "M9.5 15.5h5",
  ],
  export: ["M12 3v12", "m7.5 10.5 4.5 4.5 4.5-4.5", "M5 15.5v5h14v-5"],
  folder: [
    "M3.5 6.5h6l1.8 2h9.2v9.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z",
  ],
  folderOpen: [
    "M3.5 8V6.3a1.8 1.8 0 0 1 1.8-1.8h4.5l2 2h6.9a1.8 1.8 0 0 1 1.8 1.8v1.2",
    "m4.2 10.5 17.3-.1-2.2 9.1H6.1z",
  ],
  graph: [
    "M12 4.5v5",
    "m12 9.5-5.5 3.2",
    "m12 9.5 5.5 3.2",
    "M6.5 12.7v5",
    "M17.5 12.7v5",
    "M9.5 4.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z",
    "M4 19a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z",
    "M15 19a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z",
  ],
  key: ["M14 8a4 4 0 1 1-7.6 1.7L3 13v3h3v3h3l4.4-4.4A4 4 0 0 1 14 8Z"],
  new: ["M12 5v14", "M5 12h14"],
  open: [
    "M3.5 8V6.3a1.8 1.8 0 0 1 1.8-1.8h4.5l2 2h6.9a1.8 1.8 0 0 1 1.8 1.8v1.2",
    "m4.2 10.5 17.3-.1-2.2 9.1H6.1z",
  ],
  refresh: ["M19.5 7.5V3.8l-2.2 2.1A8 8 0 1 0 20 12", "M19.5 3.8h-3.7"],
  save: ["M5 3.5h12.5l2 2v15H4.5v-17z", "M8 3.5v6h8v-6", "M8 20.5v-7h8v7"],
  send: ["m3.5 4 17 8-17 8 3-8z", "M6.5 12h14"],
  settings: [
    "M4 6h16",
    "M4 12h16",
    "M4 18h16",
    "M8 4v4",
    "M16 10v4",
    "M10 16v4",
  ],
  sidebar: ["M4 4.5h16v15H4z", "M9 4.5v15"],
  trash: [
    "M4.5 7h15",
    "M9 7V4.5h6V7",
    "m6.5 7 .8 13h9.4l.8-13",
    "M10 10.5v6",
    "M14 10.5v6",
  ],
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      {ICON_PATHS[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
