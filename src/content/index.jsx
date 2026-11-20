import { clampSpeed, setVideoSpeed, readPrefSpeed, savePrefSpeed } from './speed.js'
import { bindCrossfade } from './crossfade.js'

/**
 * Content script — solo lógica, sin UI flotante.
 * El control de velocidad se hace desde el popup (ícono de extensión).
 */

function getVideo() {
  return (
    document.querySelector('#movie_player video.html5-main-video') ||
    document.querySelector('video.html5-main-video') ||
    document.querySelector('video')
  )
}

// Aplica velocidad guardada al cargar
function applyPreferred() {
  const preferred = readPrefSpeed()
  if (preferred == null) return
  const video = getVideo()
  if (video) setVideoSpeed(video, preferred)
}

// Escucha mensajes del popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const video = getVideo()

  if (msg.type === 'GET_SPEED') {
    sendResponse({ speed: video ? video.playbackRate : 1 })
    return true
  }

  if (msg.type === 'SET_SPEED') {
    if (!video) { sendResponse({ speed: 1 }); return true }
    const applied = setVideoSpeed(video, msg.speed)
    sendResponse({ speed: applied })
    return true
  }
})

// Atajos de teclado
function bindKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return

    const video = getVideo()
    if (!video) return

    let handled = true
    if (e.key === '+' || e.key === '=') {
      setVideoSpeed(video, clampSpeed(video.playbackRate + 0.25))
    } else if (e.key === '-') {
      setVideoSpeed(video, clampSpeed(video.playbackRate - 0.25))
    } else if (e.key === 'r' || e.key === 'R') {
      setVideoSpeed(video, 1)
    } else if (e.key === 'c' || e.key === 'C') {
      setVideoSpeed(video, 2)
    } else {
      handled = false
    }
    if (handled) e.preventDefault()
  })
}

// Persiste cambios del menú nativo de YouTube
function observeRateChanges() {
  document.addEventListener('ratechange', (e) => {
    const video = e.target
    if (video && video.tagName === 'VIDEO' && video.playbackRate > 0) {
      savePrefSpeed(video.playbackRate)
    }
  }, true)
}

function init() {
  applyPreferred()
  bindKeyboardShortcuts()
  observeRateChanges()

  // Navegación SPA
  window.addEventListener('yt-navigate-finish', applyPreferred)
  window.addEventListener('yt-navigate-finished', applyPreferred)
}

// Espera a que el video esté listo
function waitAndInit(retries = 40) {
  if (getVideo()) { init(); return }
  if (retries > 0) setTimeout(() => waitAndInit(retries - 1), 500)
}

if (location.hostname === 'music.youtube.com') bindCrossfade(getVideo)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => waitAndInit(), { once: true })
} else {
  waitAndInit()
}
