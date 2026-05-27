'use client';

type JsQRFn = typeof import('jsqr').default;

let cachedPromise: Promise<JsQRFn> | null = null;

/**
 * Lazy-load `jsqr` on first scan. Keeps ~16KB gzipped off the initial JS
 * bundle of every page that hosts a scanner — the module only downloads when
 * the user actually starts a camera scan. The promise is cached so concurrent
 * scanners on the same page share a single download.
 */
export function loadJsQR(): Promise<JsQRFn> {
  if (!cachedPromise) {
    cachedPromise = import('jsqr').then((m) => m.default);
  }
  return cachedPromise;
}
