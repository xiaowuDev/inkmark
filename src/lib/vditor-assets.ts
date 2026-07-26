export function vditorAssetBaseUrl(): string {
  return new URL("vditor", document.baseURI).href.replace(/\/$/u, "");
}
