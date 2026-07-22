import { useState } from "react";

/**
 * RestaurantLogo
 * ---------------------------------------------------------------------------
 * Shared logo component used by every restaurant menu template (MenuTemplate,
 * CheeziousMenu, and any future templates) so logos behave and look
 * identically everywhere instead of each template reimplementing its own
 * version.
 *
 * Rendered as a small circular avatar (like a profile picture) rather than a
 * free-form rectangular logo:
 *  - Logo set -> the image fills the circle via object-fit: cover.
 *  - No logo, or the image URL fails to load (404, network error, bad file)
 *    -> falls back to the restaurant's first initial on a colored circle,
 *    matching the same fallback convention already used for restaurant cards
 *    on the /restaurants directory page (RestaurantListPage.tsx).
 *
 * `height` sets the avatar's diameter (it's also its width, since it's a
 * circle) — kept as `height` rather than renamed to `size` so existing call
 * sites (MenuTemplate, CheeziousMenu) didn't need to change their prop name.
 */
export function RestaurantLogo({ logo, name, height = 40 }: { logo: string; name: string; height?: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(logo) && !imageFailed;

  return (
    <div
      style={{
        width: height,
        height: height,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: showImage ? "#fff" : "#c9762f",
        border: "1px solid rgba(0,0,0,0.1)",
      }}
    >
      {showImage ? (
        <img
          src={logo}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: Math.round(height * 0.42),
            fontFamily: "'Poppins',sans-serif",
            lineHeight: 1,
          }}
        >
          {name?.trim()?.charAt(0)?.toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}

export default RestaurantLogo;