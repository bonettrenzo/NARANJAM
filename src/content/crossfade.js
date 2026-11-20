import { CROSSFADE_KEY, DEFAULT_CROSSFADE, normalizeCrossfade } from '../crossfade-settings.js'

const NEXT_BUTTON = [
  '.ytmusicPlayerControlsNextButton button',
  'ytmusic-player-bar .next-button'
].join(', ')
const POLL_MS = 25
const LOAD_TIMEOUT_MS = 8000

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
      if (!settings.enabled) {
        if (transition?.phase === 'out') advance(transition)
        else finish()
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
    restoreVolume(state)
  }

  function advance(state, useTransition = settings.enabled) {
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

  function startFadeIn(state) {
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
        if (playing) startFadeIn(state)
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

    if (state.phase === 'out') {
      const progress = Math.min(1, elapsed / state.fadeOut)
      writeVolume(state, state.startFactor * (1 - progress))
      if (progress === 1) advance(state)
    } else {
      writeVolume(state, Math.min(1, elapsed / state.fadeIn))
      if (elapsed >= state.fadeIn) finish()
    }
  }

  window.addEventListener('click', (event) => {
    if (nativeClick || !settings.enabled) return
    const button = event.composedPath().find((node) => node.matches?.(NEXT_BUTTON))
    if (!isAvailable(button)) return

    if (transition?.phase === 'out' || transition?.phase === 'load') {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    const video = getVideo()
    const { fadeOut, fadeIn } = settings
    if (!video || video.paused || video.ended || video.muted ||
      (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime === 0) ||
      video.volume === 0 || isAd(video) || (!fadeOut && !fadeIn)) return

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
      fadeIn: fadeIn * 1000
    }
    if (video.volume !== startingVolume) video.volume = startingVolume
    transition = state
    state.timer = setInterval(() => tick(state), POLL_MS)
    if (!fadeOut) advance(state)
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
      startFadeIn(state)
    }
  }, true)

  window.addEventListener('pagehide', finish)
}
