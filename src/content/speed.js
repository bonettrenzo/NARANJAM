// Utilidades de velocidad compartidas entre la UI y los atajos de teclado.

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

const STORAGE_KEY = 'naranjam:speed'

export function clampSpeed(value) {
  const rounded = Math.round(value * 100) / 100
  return Math.min(4, Math.max(0.25, rounded))
}

export function readPrefSpeed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

export function savePrefSpeed(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // sin storage: la preferencia solo dura esta sesión
  }
}

export function setVideoSpeed(video, value) {
  const speed = clampSpeed(value)
  video.playbackRate = speed
  savePrefSpeed(speed)
  // A veces YouTube resetea el rate al reproducir; lo reafirmamos
  const onPlay = () => {
    if (Math.abs(video.playbackRate - speed) > 0.01) video.playbackRate = speed
  }
  video.addEventListener('play', onPlay, { once: true })
  return speed
}
