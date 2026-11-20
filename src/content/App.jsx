import React, { useEffect, useState, useCallback } from 'react'
import { SPEEDS, setVideoSpeed } from './speed.js'

export default function App({ video }) {
  const [rate, setRate] = useState(() => video.playbackRate || 1)
  const [open, setOpen] = useState(true)
  const [toast, setToast] = useState(null)

  // Mantener el estado sincronizado si la velocidad cambia
  // por otra vía (menú nativo de YouTube, atajos de teclado, etc.)
  useEffect(() => {
    const onRateChange = () => setRate(video.playbackRate)
    video.addEventListener('ratechange', onRateChange)
    return () => video.removeEventListener('ratechange', onRateChange)
  }, [video])

  const apply = useCallback(
    (value) => {
      const applied = setVideoSpeed(video, value)
      setRate(applied)
      setToast(`${applied}x`)
      setTimeout(() => setToast(null), 900)
    },
    [video]
  )

  return (
    <div className="nj-root">
      {toast && <div className="nj-toast">{toast}</div>}

      <div className="nj-panel" data-open={open}>
        <div className="nj-header">
          <span className="nj-title">Velocidad: {rate}x</span>
          <button className="nj-toggle" onClick={() => setOpen((o) => !o)} title="Mostrar/ocultar">
            {open ? '×' : '⚡'}
          </button>
        </div>

        {open && (
          <div className="nj-buttons">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className="nj-btn"
                data-active={Math.abs(rate - s) < 0.01}
                onClick={() => apply(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
