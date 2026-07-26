import type { SVGProps } from "react";

export type IconName =
  | "chevron"
  | "close"
  | "document"
  | "export"
  | "folder"
  | "folderOpen"
  | "moon"
  | "new"
  | "open"
  | "save"
  | "sidebar"
  | "sun";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const ICON_PATHS: Record<IconName, string[]> = {
  chevron: ["m9 18 6-6-6-6"],
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
  moon: ["M20 15.3A8.3 8.3 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"],
  new: ["M12 5v14", "M5 12h14"],
  open: [
    "M3.5 8V6.3a1.8 1.8 0 0 1 1.8-1.8h4.5l2 2h6.9a1.8 1.8 0 0 1 1.8 1.8v1.2",
    "m4.2 10.5 17.3-.1-2.2 9.1H6.1z",
  ],
  save: ["M5 3.5h12.5l2 2v15H4.5v-17z", "M8 3.5v6h8v-6", "M8 20.5v-7h8v7"],
  sidebar: ["M4 4.5h16v15H4z", "M9 4.5v15"],
  sun: [
    "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z",
    "M12 2.5v2",
    "M12 19.5v2",
    "m4.2 4.2 1.4 1.4",
    "m18.4 18.4 1.4 1.4",
    "M2.5 12h2",
    "M19.5 12h2",
    "m4.2 19.8 1.4-1.4",
    "m18.4 5.6 1.4-1.4",
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
