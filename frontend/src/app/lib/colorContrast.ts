/**
 * Given a background color (hex, e.g. "#c9762f" or "#fff"), returns the
 * more readable of black/white text for it, based on perceived brightness
 * (YIQ formula). Used anywhere a restaurant's own brand color (primaryColor
 * / headerBg) is used as a background, since we can't control whether
 * restaurants pick light or dark brand colors.
 */
export function getContrastTextColor(hex: string, dark = "#1a1a1a", light = "#ffffff"): string {
  if (!hex) return dark;

  let c = hex.trim().replace("#", "");
  if (c.length === 3) {
    c = c.split("").map(ch => ch + ch).join("");
  }
  if (c.length !== 6) return dark;

  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);

  if ([r, g, b].some(n => Number.isNaN(n))) return dark;

  // Perceived brightness (YIQ). > 150 reads as a "bright" background.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 150 ? dark : light;
}