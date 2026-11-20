export const CROSSFADE_KEY = 'crossfade'
export const MAX_FADE_SECONDS = 10

export const DEFAULT_CROSSFADE = Object.freeze({
  enabled: true,
  fadeOut: 2,
  fadeIn: 2,
  trimSilence: false
})

export function normalizeCrossfade(settings) {
  return {
    enabled: settings?.enabled !== false,
    fadeOut: normalizeSeconds(settings?.fadeOut, DEFAULT_CROSSFADE.fadeOut),
    fadeIn: normalizeSeconds(settings?.fadeIn, DEFAULT_CROSSFADE.fadeIn),
    trimSilence: settings?.trimSilence === true
  }
}

function normalizeSeconds(value, fallback) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(MAX_FADE_SECONDS, Math.max(0, value))
}
