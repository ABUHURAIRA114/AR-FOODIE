import { useState } from "react";

/**
 * RestaurantLogo
 * ---------------------------------------------------------------------------
 * Shared logo component used by every restaurant menu template (MenuTemplate,
 * CheeziousMenu, and any future templates) so logos behave identically
 * everywhere instead of each template reimplementing its own version.
 *
 * Renders the logo image as-is — transparent background, no cropping, no
 * circular mask — scaled down to a small fixed height with its natural
 * aspect ratio preserved, so it fits compactly in the header corner
 * regardless of whether the source logo is a square icon or a wide
 * landscape wordmark (e.g. an icon + text lockup like "Cheezious").
 * A circular "profile pic" crop only looks right for square icon logos; it
 * badly crops/distorts landscape ones, which is why this doesn't force one.
 *
 *  - No logo set (or the field is empty/null) -> falls back to the
 *    restaurant's name as styled text, instead of a broken/missing image.
 *  - Logo URL set but the image itself fails to load (404, network error,
 *    bad file) -> also falls back to that same text, instead of showing a
 *    broken-image icon.
 */
export function RestaurantLogo({
  logo,
  name,
  size = 40,
}: {
  logo: string;
  name: string;
  /** Fixed height of the logo, in pixels. Width scales automatically to preserve its natural aspect ratio. Defaults to 40 (small, corner-badge sized). */
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(logo) && !imgFailed;

  if (showImage) {
    return (
      <img
        src={logo}
        alt={name}
        onError={() => setImgFailed(true)}
        style={{
          height: size,
          width: "auto",
          maxWidth: size * 3.5, // guards against an unexpectedly ultra-wide source image crowding the header
          objectFit: "contain",
          display: "block",
          background: "transparent",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "#333", fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>
      {name}
    </span>
  );
}

export default RestaurantLogo;