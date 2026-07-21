/**
 * RestaurantLogo
 * ---------------------------------------------------------------------------
 * Shared logo component used by every restaurant menu template (MenuTemplate,
 * CheeziousMenu, and any future templates) so logos behave identically
 * everywhere instead of each template reimplementing its own version:
 *
 *  - No logo set (or the field is empty/null) -> falls back to the
 *    restaurant's name as styled text, instead of a broken/missing image.
 *  - Logo URL set but the image itself fails to load (404, network error,
 *    bad file) -> hides the broken image via onError rather than showing
 *    the browser's broken-image icon.
 *
 * Previously this logic lived only inside MenuTemplate.tsx, while
 * CheeziousMenu.tsx rendered a raw <img src={logo} /> with no fallback at
 * all — meaning a missing/broken logo behaved differently (and worse)
 * depending on which template a restaurant happened to be using.
 */
export function RestaurantLogo({ logo, name, height }: { logo: string; name: string; height: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        height={height}
        style={{ objectFit: "contain", display: "block" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "#333", fontFamily: "'Poppins',sans-serif" }}>
      {name}
    </span>
  );
}

export default RestaurantLogo;