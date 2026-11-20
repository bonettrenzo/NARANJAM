import { isTemporaryPlaybackRate, useTemporaryPlaybackRate } from './speed.js'

const MAX_SCAN_SECONDS = 4
const MAX_SCAN_MS = 1400
const SCAN_RATE = 4
const MAX_START_TIME = 0.35
const AUDIO_LEAD_SECONDS = 0.22

export function openSilenceAnalyzer() {
  try {
    const context = new AudioContext()
    // Resume while the original button click still grants user activation.
    context.resume().catch(() => {})
    return context
  } catch {
    return null
  }
}

export function scanInitialSilence(context, video) {
  if (context?.state !== 'running' || video.currentTime > MAX_START_TIME) return null

  const startTime = video.currentTime
  const started = performance.now()
  let stream
  let source
  let restoreRate
  try {
    stream = video.captureStream()
    const [audio] = stream.getAudioTracks()
    if (!audio) {
      stream.getTracks().forEach((track) => track.stop())
      return null
    }
    source = context.createMediaStreamSource(new MediaStream([audio]))
    const analyzer = context.createAnalyser()
    analyzer.fftSize = 2048
    source.connect(analyzer)
    const samples = new Float32Array(analyzer.fftSize)
    restoreRate = useTemporaryPlaybackRate(video, SCAN_RATE)

    const detectsSound = () => !audio.muted && hasSound(analyzer, samples)
    return {
      startTime,
      detectsSound,
      restoreRate,
      read() {
        if (audio.readyState === 'ended' || !isTemporaryPlaybackRate(video)) {
          return { time: startTime, detected: false }
        }
        if (detectsSound()) {
          return { time: Math.max(startTime, video.currentTime - AUDIO_LEAD_SECONDS), detected: true }
        }
        if (video.currentTime >= MAX_SCAN_SECONDS || performance.now() - started >= MAX_SCAN_MS) {
          return { time: startTime, detected: false }
        }
        return null
      },
      stop() {
        restoreRate()
        source.disconnect()
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  } catch {
    restoreRate?.()
    source?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    return null
  }
}

function hasSound(analyzer, samples) {
  analyzer.getFloatTimeDomainData(samples)
  let power = 0
  for (const value of samples) {
    if (Math.abs(value) >= 0.015) return true
    power += value * value
  }
  return power / samples.length >= 0.002 ** 2
}
