// Compatibility shim for mind-ar's prebuilt bundle (mindar-image-three.prod.js),
// which imports the legacy `sRGBEncoding` constant. That constant was removed
// from three.js in r152+ (replaced by `.colorSpace` / `SRGBColorSpace`), but
// this project uses a much newer three.js than mind-ar's dist was built
// against, so the bare import fails at build time.
//
// This file is aliased in place of the bare "three" specifier (see
// vite.config.ts) for every import in the app, so it re-exports everything
// from the real three.js untouched, plus the one legacy numeric constant
// mind-ar still references. Nothing else in the app uses `sRGBEncoding`, so
// this has no effect anywhere except letting mind-ar's import resolve.
export * from "three";

// Legacy value of THREE.sRGBEncoding from pre-r152 three.js.
export const sRGBEncoding = 3001;