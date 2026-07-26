import { invoke, isTauri } from "@tauri-apps/api/core";

import { vditorAssetBaseUrl } from "./vditor-assets";

const PRINT_ROOT_ID = "inkmark-print-document";

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function pdfTitle(fileName: string): string {
  return (
    fileName.replace(/\.(?:md|markdown|mdown|mkd|txt)$/iu, "") || "InkMark 文稿"
  );
}

export async function printMarkdownAsPdf(
  markdown: string,
  fileName: string,
): Promise<void> {
  document.getElementById(PRINT_ROOT_ID)?.remove();

  const { default: Vditor } = await import("vditor");
  const printRoot = document.createElement("div");
  printRoot.className = "print-document";
  printRoot.id = PRINT_ROOT_ID;
  printRoot.setAttribute("role", "document");
  document.body.append(printRoot);

  await Vditor.preview(printRoot, markdown, {
    cdn: vditorAssetBaseUrl(),
    hljs: {
      enable: true,
      lineNumber: false,
      style: "github",
    },
    lang: "zh_CN",
    markdown: {
      codeBlockPreview: true,
      footnotes: true,
      gfmAutoLink: true,
      mark: true,
      mathBlockPreview: true,
      sanitize: true,
      toc: true,
    },
    math: {
      engine: "KaTeX",
      inlineDigit: true,
    },
    mode: "light",
    theme: {
      current: "light",
      path: `${vditorAssetBaseUrl()}/dist/css/content-theme`,
    },
  });

  const previousTitle = document.title;
  const cleanup = () => {
    window.removeEventListener("afterprint", cleanup);
    document.documentElement.classList.remove("is-exporting-pdf");
    document.body.classList.remove("is-exporting-pdf");
    document.title = previousTitle;
    printRoot.remove();
  };

  document.title = pdfTitle(fileName);
  document.documentElement.classList.add("is-exporting-pdf");
  document.body.classList.add("is-exporting-pdf");
  await nextPaint();
  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    if (isTauri()) {
      await invoke("print_document");
    } else {
      window.print();
    }
  } finally {
    window.setTimeout(cleanup, 0);
  }
}
