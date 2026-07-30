/** Default profile image when the pro skips a photo (initial on scheme color). */
export function defaultProAvatarDataUrl(displayName: string, bgHex: string): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(bgHex) ? bgHex : "#1e3a5f";
  const letter = (displayName.trim().slice(0, 1) || "P").toUpperCase();
  const ch = escapeXml(letter);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="${safe}"/><text x="128" y="154" text-anchor="middle" font-size="112" font-family="system-ui,sans-serif" font-weight="600" fill="#ffffff">${ch}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function dataUrlToPngFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/png" });
}
