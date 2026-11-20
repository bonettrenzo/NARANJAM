// Presets rápidos que aparecen como botones de acceso rápido
const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

const mainEl      = document.getElementById('main')
const statusEl    = document.getElementById('status')
const bigRateEl   = document.getElementById('bigRate')
const presetsEl   = document.getElementById('presets')
const customInput = document.getElementById('customInput')
const applyBtn    = document.getElementById('applyBtn')
const minus05Btn  = document.getElementById('minus05')
const plus05Btn   = document.getElementById('plus05')

let currentTab  = null
let currentRate = 1

// ── Helpers ─────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100
}

function clamp(n) {
  return Math.min(4, Math.max(0.1, round2(n)))
}

// ── Render ───────────────────────────────────────────────────────────────────

function updateUI(rate) {
  currentRate = rate
  bigRateEl.textContent = rate + 'x'

  // Actualiza estado activo en los presets
  presetsEl.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - rate) < 0.005)
  })
}

function buildPresets() {
  presetsEl.innerHTML = ''
  PRESETS.forEach(s => {
    const btn = document.createElement('button')
    btn.textContent = s + 'x'
    btn.dataset.speed = s
    btn.addEventListener('click', () => applySpeed(s))
    presetsEl.appendChild(btn)
  })
}

// ── Comunicación con el content script ──────────────────────────────────────

function applySpeed(speed) {
  const s = clamp(speed)
  if (!currentTab) return
  chrome.tabs.sendMessage(currentTab.id, { type: 'SET_SPEED', speed: s }, (res) => {
    if (chrome.runtime.lastError) return
    if (res && res.speed != null) updateUI(res.speed)
  })
}

// ── Eventos de la UI ─────────────────────────────────────────────────────────

// Ajuste fino −0.05
minus05Btn.addEventListener('click', () => applySpeed(currentRate - 0.05))

// Ajuste fino +0.05
plus05Btn.addEventListener('click', () => applySpeed(currentRate + 0.05))

// Input libre: aplicar con botón
applyBtn.addEventListener('click', () => {
  const val = parseFloat(customInput.value)
  if (isNaN(val) || val <= 0) return
  applySpeed(val)
  customInput.value = ''
})

// Input libre: aplicar con Enter
customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyBtn.click()
})

// ── Inicio ───────────────────────────────────────────────────────────────────

buildPresets()

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) { statusEl.textContent = 'No hay pestaña activa'; return }
  currentTab = tabs[0]

  const url = currentTab.url || ''
  const isYT = url.includes('youtube.com')
  if (!isYT) {
    statusEl.textContent = 'Abre YouTube o YouTube Music'
    return
  }

  chrome.tabs.sendMessage(currentTab.id, { type: 'GET_SPEED' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      statusEl.textContent = 'Recarga la pestaña de YouTube'
      return
    }
    statusEl.style.display = 'none'
    mainEl.style.display   = 'block'
    updateUI(res.speed)
  })
})
