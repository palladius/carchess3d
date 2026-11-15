/**
 * @fileoverview Device capability detection & model LOD resolution.
 * Headless: zero DOM or WebGL imports, fully unit-testable.
 * Follows Niccolò Game Design Rule #6 (Logic is headless).
 */

export const QUALITY_TIERS = Object.freeze(['low', 'medium', 'high', 'auto']);

/**
 * Detects whether CarChess3D should run in Raspberry Pi / ultra-lightweight Turbo mode.
 * Triggers on:
 * - Explicit early-boot flag (`env.rpiTurboMode` or `window._rpiTurboMode`)
 * - Query params (`?rpi=1`, `?sguisatazzo=1`, `?lowperf=1`, `?lite=1`) unless `?rpi=0` / `?highperf=1`
 * - Linux ARM SBC User-Agent / Platform (`Linux` + `aarch64|arm64|armv7|armv8|raspbian|crKey`)
 * - Scaled launcher DPR (`devicePixelRatio <= 0.85`, e.g. sguisa-game-runner)
 *
 * @param {object} [env]
 * @returns {boolean}
 */
export function detectRpiTurboMode(env = {}) {
  const search =
    typeof env.search === 'string'
      ? env.search
      : typeof window !== 'undefined' && window.location
        ? window.location.search || ''
        : '';
  if (search && typeof URLSearchParams !== 'undefined') {
    const sp = new URLSearchParams(search);
    const rpiParam = sp.get('rpi');
    if (
      rpiParam === '0' ||
      rpiParam === 'false' ||
      sp.get('highperf') === '1' ||
      sp.get('highperf') === 'true'
    ) {
      return false;
    }
    if (
      rpiParam === '1' ||
      rpiParam === 'true' ||
      sp.get('sguisatazzo') === '1' ||
      sp.get('sguisatazzo') === 'true' ||
      sp.get('lowperf') === '1' ||
      sp.get('lowperf') === 'true' ||
      sp.get('lite') === '1' ||
      sp.get('lite') === 'true'
    ) {
      return true;
    }
  }

  if (typeof env.rpiTurboMode === 'boolean') {
    return env.rpiTurboMode;
  }
  if (
    Object.keys(env).length === 0 &&
    typeof window !== 'undefined' &&
    typeof window._rpiTurboMode === 'boolean'
  ) {
    return window._rpiTurboMode;
  }

  const stored =
    typeof env.storedRpiTurbo === 'string'
      ? env.storedRpiTurbo
      : typeof window !== 'undefined' && window.localStorage
        ? (() => {
            try {
              return window.localStorage.getItem('carchess3d_rpi_turbo');
            } catch {
              return null;
            }
          })()
        : null;
  if (stored === '1') return true;
  if (stored === '0') return false;

  const ua = [
    env.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    env.platform || (typeof navigator !== 'undefined' ? navigator.platform : ''),
  ]
    .filter(Boolean)
    .join(' ');
  const isLinuxArm = /linux/i.test(ua) && /(aarch64|arm64|armv7|armv8|raspbian|crkey)/i.test(ua);
  const dpr =
    typeof env.devicePixelRatio === 'number'
      ? env.devicePixelRatio
      : typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : 1;
  const isScaledRunner = dpr > 0 && dpr <= 0.85;

  return isLinuxArm || isScaledRunner;
}

/**
 * Detect hardware tier ('low' | 'medium' | 'high') based on available hardware signals.
 *
 * - Raspberry Pi / RPi Turbo or Mobile phones -> 'low' (aims for ~10k poly GLBs)
 * - Tablets / iPads / intermediate -> 'medium' (aims for ~50k poly GLBs)
 * - Modern Desktops / Computerone -> 'high' (aims for ~1000k / full quality GLBs)
 *
 * @param {object} [env]
 * @returns {'low'|'medium'|'high'}
 */
export function detectHardwareTier(env = {}) {
  if (detectRpiTurboMode(env)) {
    return 'low';
  }
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
