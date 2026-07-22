import { useState } from "react";

/**
 * RestaurantLogo
 * ---------------------------------------------------------------------------
 * Shared logo component used by every restaurant menu template (MenuTemplate,
 * CheeziousMenu, and any future templates) so logos behave identically
 * everywhere instead of each template reimplementing its own version.
 *
 * Renders as a small circular "profile picture" style badge, meant to sit in
 * the corner of the header rather than compete for space as a full-size
 * rectangular logo:
 *
 *  - No logo set (or the field is empty/null) -> falls back to a colored
 *    circle with the restaurant's first initial, instead of a broken/missing
 *    image. Uses the same "colored circle + initial" convention as the
 *    restaurant directory page (RestaurantListPage), so logo fallbacks look
 *    consistent everywhere in the app, not just across menu templates.
 *  - Logo URL set but the image itself fails to load (404, network error,
 *    bad file) -> falls back to that same initial-letter circle instead of
 *    showing a broken-image icon.
 */
export function RestaurantLogo({
  logo,
  name,
  size = 40,
  accentColor = "#c9762f",
}: {
  logo: string;
  name: string;
  /** Diameter of the circular badge, in pixels. Defaults to 40 (small, corner-badge sized). */
  size?: number;
  /** Background color used for the fallback initial-letter circle when there's no logo. */
  accentColor?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(logo) && !imgFailed;
  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: showImage ? "#fff" : accentColor,
        border: "2px solid rgba(255,255,255,0.9)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImage ? (
        <img
          src={logo}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.42,
            fontFamily: "'Poppins',sans-serif",
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

export default RestaurantLogo;