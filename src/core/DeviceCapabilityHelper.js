/**
 * @fileoverview Device capability detection & model LOD resolution.
 * Headless: zero DOM or WebGL imports, fully unit-testable.
 * Follows Niccolò Game Design Rule #6 (Logic is headless).
 */

export const QUALITY_TIERS = Object.freeze(['low', 'medium', 'high', 'auto']);

/**
 * Detect hardware tier ('low' | 'medium' | 'high') based on available hardware signals.
 *
 * - Mobile phones -> 'low' (aims for ~10k poly GLBs)
 * - Tablets / iPads / intermediate -> 'medium' (aims for ~50k poly GLBs)
 * - Modern Desktops / Computerone -> 'high' (aims for ~1000k / full quality GLBs)
 *
 * @param {object} [env]
 * @returns {'low'|'medium'|'high'}
 */
export function detectHardwareTier(env = {}) {
  const ua = (env.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  const width = env.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const height = env.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const mem =
    typeof env.deviceMemory === 'number'
      ? env.deviceMemory
      : typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? navigator.deviceMemory
        : 8;
  const cores =
    typeof env.hardwareConcurrency === 'number'
      ? env.hardwareConcurrency
      : typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
        ? navigator.hardwareConcurrency
        : 8;

  const isMobile =
    /android|iphone|ipod|mobile/i.test(ua) || (maxDim < 900 && minDim < 600);
  const isTablet =
    /ipad|tablet/i.test(ua) ||
    (minDim >= 600 &&
      maxDim <= 1366 &&
      (Boolean(env.isTouch) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window) ||
        /macintosh/i.test(ua)));

  if (isMobile) {
    return 'low';
  }
  if (isTablet || mem <= 4 || cores <= 4) {
    return 'medium';
  }
  return 'high';
}

/**
 * Resolve effective model LOD tier from user preference and detected tier.
 *
 * @param {string|null} userSetting
 * @param {'low'|'medium'|'high'} detectedTier
 * @returns {'low'|'medium'|'high'}
 */
export function resolveModelLod(userSetting = 'auto', detectedTier = 'high') {
  if (userSetting && userSetting !== 'auto' && QUALITY_TIERS.includes(userSetting)) {
    return userSetting;
  }
  return detectedTier || 'high';
}
