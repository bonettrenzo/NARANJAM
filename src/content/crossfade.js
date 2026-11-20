import { CROSSFADE_KEY, DEFAULT_CROSSFADE, normalizeCrossfade } from '../crossfade-settings.js'
import { openSilenceAnalyzer, scanInitialSilence } from './initial-silence.js'

const NEXT_BUTTON = [
  '.ytmusicPlayerControlsNextButton button',
  'ytmusic-player-bar .next-button'
].join(', ')
const POLL_MS = 25
const LOAD_TIMEOUT_MS = 8000
const SEEK_TIMEOUT_MS = 1200
const ANALYZER_WINDOW_MS = 65

function isAvailable(button) {
  return button?.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true'
}

function isAd(video) {
  return Boolean(video.closest('.ad-showing, .ad-interrupting'))
}

function trackId() {
  return new URLSearchParams(location.search).get('v')
}

export function bindCrossfade(getVideo) {
  let settings = DEFAULT_CROSSFADE
  let settingsUpdated = false
  let transition
  let nativeClick = false

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CROSSFADE_KEY]) {
      settingsUpdated = true
      settings = normalizeCrossfade(changes[CROSSFADE_KEY].newValue)
      const state = transition
      if (!state) return
      if (!settings.trimSilence) {
        if (state.scan) completeScan(state, { time: state.scan.startTime, detected: false })
        else stopAnalysis(state)
      }
      if (!settings.enabled) {
        state.fadeIn = 0
        if (state.phase === 'out') advance(state, Boolean(state.audioContext))
        else if (state.phase === 'in' || (state.phase === 'load' && !state.audioContext)) finish()
      }
    }
  })
  chrome.storage.local.get(CROSSFADE_KEY, (stored) => {
    if (!settingsUpdated) settings = normalizeCrossfade(stored?.[CROSSFADE_KEY])
  })

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'GET_CROSSFADE_STATUS') {
      respond({
        ready: Boolean(getVideo() && document.querySelector(NEXT_BUTTON))
      })
    }
  })

  function writeVolume(state, factor) {
    const { video } = state
    if (video.volume !== state.lastVolume) state.volume = video.volume
    state.lastVolume = state.volume * factor
    video.volume = state.lastVolume
  }

  function restoreVolume(state) {
    if (state.video.volume === state.lastVolume) state.video.volume = state.volume
  }

  function finish() {
    if (!transition) return
    const state = transition
    transition = undefined
    clearInterval(state.timer)
    stopAnalysis(state)
    restoreVolume(state)
  }

  function advance(state, useTransition = settings.enabled || Boolean(state.audioContext)) {
    const button = isAvailable(state.button)
      ? state.button
      : [...document.querySelectorAll(NEXT_BUTTON)].find(isAvailable)
    if (!button) {
      finish()
      return
    }

    if (useTransition) {
      state.phase = 'load'
      state.started = performance.now()
      state.outgoingTime = state.video.currentTime
      state.observedTime = state.outgoingTime
      writeVolume(state, 0)
    } else {
      finish()
    }

    nativeClick = true
    try {
      button.click()
    } finally {
      nativeClick = false
    }
  }

  function hasNewTrack(state, video) {
    return video !== state.video ||
      state.loading ||
      video.currentSrc !== state.source ||
      (trackId() !== state.track && video.currentTime < state.outgoingTime)
  }

  function prepareIncoming(state, video) {
    if (video !== state.video) {
      restoreVolume(state)
      state.video = video
      state.volume = video.volume
      state.lastVolume = video.volume
    }
    state.loading = true
    writeVolume(state, 0)
  }

  function stopAnalysis(state) {
    state.scan?.stop()
    state.scan = undefined
    state.audioContext?.close().catch(() => {})
    state.audioContext = undefined
  }

  function beginIncoming(state) {
    state.scan = scanInitialSilence(state.audioContext, state.video)
    if (state.scan) {
      state.phase = 'scan'
      state.source = state.video.currentSrc
    } else {
      startFadeIn(state)
    }
  }

  function completeScan(state, { time, detected }) {
    if (detected && time > state.scan.startTime + 0.05) state.scan.restoreRate()
    else stopAnalysis(state)
    if (Math.abs(state.video.currentTime - time) > 0.02) {
      state.phase = 'seek'
      state.started = performance.now()
      state.video.currentTime = time
    } else {
      startFadeIn(state)
    }
  }

  function startFadeIn(state) {
    stopAnalysis(state)
    if (!state.fadeIn) {
      finish()
      return
    }
    state.phase = 'in'
    state.started = performance.now()
    state.source = state.video.currentSrc
  }

  function tick(state) {
    const video = getVideo()
    const elapsed = performance.now() - state.started
    if (state.phase === 'load') {
      if (elapsed >= LOAD_TIMEOUT_MS || (video && isAd(video))) {
        finish()
      } else if (video && hasNewTrack(state, video)) {
        const playing = state.loading && video === state.video &&
          !video.paused && !video.seeking && video.readyState >= 3 &&
          video.currentTime > state.observedTime
        prepareIncoming(state, video)
        state.observedTime = video.currentTime
        if (playing) beginIncoming(state)
      }
      return
    }

    const currentTrack = state.phase === 'out' ? trackId() : null
    if (video !== state.video || (state.track && currentTrack && currentTrack !== state.track)) {
      finish()
      return
    }
    if (isAd(video)) {
      if (state.phase === 'out') advance(state, false)
      else finish()
      return
    }
    if (video.paused || video.ended || video.currentSrc !== state.source) {
      finish()
      return
    }

    if (state.phase === 'scan') {
      const result = state.scan.read()
      if (result) completeScan(state, result)
      else writeVolume(state, 0)
    } else if (state.phase === 'seek') {
      if (elapsed >= SEEK_TIMEOUT_MS) {
        startFadeIn(state)
      } else if (!video.seeking && state.scan) {
        state.phase = 'confirm'
        state.started = performance.now()
        state.confirmTimeout = Math.min(1500, Math.max(450, 650 / video.playbackRate))
      } else if (!video.seeking) {
        startFadeIn(state)
      } else {
        writeVolume(state, 0)
      }
    } else if (state.phase === 'confirm') {
      // Let the analyzer's buffer refill at normal speed after the seek.
      if (elapsed >= state.confirmTimeout ||
        (elapsed >= ANALYZER_WINDOW_MS && state.scan.detectsSound())) {
        startFadeIn(state)
      } else {
        writeVolume(state, 0)
      }
    } else if (state.phase === 'out') {
      const progress = Math.min(1, elapsed / state.fadeOut)
      writeVolume(state, state.startFactor * (1 - progress))
      if (progress === 1) advance(state)
    } else {
      writeVolume(state, Math.min(1, elapsed / state.fadeIn))
      if (elapsed >= state.fadeIn) finish()
    }
  }

  window.addEventListener('click', (event) => {
    if (nativeClick || (!settings.enabled && !settings.trimSilence)) return
    const button = event.composedPath().find((node) => node.matches?.(NEXT_BUTTON))
    if (!isAvailable(button)) return

    if (transition && transition.phase !== 'in') {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    const video = getVideo()
    const fadeOut = settings.enabled ? settings.fadeOut : 0
    const fadeIn = settings.enabled ? settings.fadeIn : 0
    if (!video || video.paused || video.ended || video.muted ||
      (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime === 0) ||
      video.volume === 0 || isAd(video) || (!fadeOut && !fadeIn && !settings.trimSilence)) return

    const audioContext = settings.trimSilence ? openSilenceAnalyzer() : null
    if (!fadeOut && !fadeIn && !audioContext) return

    const volume = transition?.video === video && transition.lastVolume === video.volume
      ? transition.volume
      : video.volume
    const startingVolume = video.volume
    finish()
    event.preventDefault()
    event.stopImmediatePropagation()

    const state = {
      button,
      video,
      volume,
      lastVolume: startingVolume,
      source: video.currentSrc,
      track: trackId(),
      phase: 'out',
      started: performance.now(),
      startFactor: startingVolume / volume,
      fadeOut: fadeOut * 1000,
      fadeIn: fadeIn * 1000,
      audioContext
    }
    if (video.volume !== startingVolume) video.volume = startingVolume
    transition = state
    state.timer = setInterval(() => tick(state), POLL_MS)
    if (!fadeOut) {
      setTimeout(() => {
        if (transition === state && state.phase === 'out') advance(state)
      }, 0)
    }
  }, { capture: true, passive: false })

  document.addEventListener('loadstart', (event) => {
    const state = transition
    if (!state || event.target !== getVideo()) return
    if (state.phase === 'load') {
      prepareIncoming(state, event.target)
      state.observedTime = event.target.currentTime
    } else if (state.phase === 'out' && event.target === state.video && isAd(event.target)) {
      advance(state, false)
    } else {
      finish()
    }
  }, true)

  document.addEventListener('playing', (event) => {
    const state = transition
    const video = getVideo()
    if (state?.phase !== 'load' || !video || event.target !== video) return
    if (isAd(video)) {
      finish()
    } else if (hasNewTrack(state, video)) {
      prepareIncoming(state, video)
      beginIncoming(state)
    }
  }, true)

  window.addEventListener('pagehide', finish)
}
