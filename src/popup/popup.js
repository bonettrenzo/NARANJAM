const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

// ── Estado ────────────────────────────────────────────────────────────────────
let currentTab  = null
let currentRate = 1
let step        = 0.05

// ── Elementos ─────────────────────────────────────────────────────────────────
const viewHome    = document.getElementById('view-home')
const viewSpeed   = document.getElementById('view-speed')
const statusEl    = document.getElementById('status')
const nowPlayingEl= document.getElementById('nowPlaying')
const speedBadge  = document.getElementById('speedBadge')

const bigRateEl   = document.getElementById('bigRate')
const presetsEl   = document.getElementById('presets')
const customInput = document.getElementById('customInput')
const applyBtn    = document.getElementById('applyBtn')
const minusBtn    = document.getElementById('minusBtn')
const plusBtn     = document.getElementById('plusBtn')
const backBtn     = document.getElementById('backBtn')
const stepBtns    = document.querySelectorAll('.step-btn')

// ── Navegación ────────────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

document.getElementById('menu-speed').addEventListener('click', () => {
  showView('view-speed')
})

backBtn.addEventListener('click', () => {
  showView('view-home')
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100 }
function clamp(n)  { return Math.min(4, Math.max(0.1, round2(n))) }

// ── UI ────────────────────────────────────────────────────────────────────────
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

function updateUI(rate) {
  currentRate = rate
  const label = rate + 'x'
  bigRateEl.textContent  = label
  speedBadge.textContent = label

  presetsEl.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - rate) < 0.005)
  })
}

// ── Paso de ajuste fino ───────────────────────────────────────────────────────
stepBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    step = parseFloat(btn.dataset.step)
    stepBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

// ── Comunicación con el content script ───────────────────────────────────────
function applySpeed(speed) {
  const s = clamp(speed)
  if (!currentTab) return
  chrome.tabs.sendMessage(currentTab.id, { type: 'SET_SPEED', speed: s }, (res) => {
    if (chrome.runtime.lastError) return
    if (res && res.speed != null) updateUI(res.speed)
  })
}

minusBtn.addEventListener('click', () => applySpeed(currentRate - step))
plusBtn.addEventListener('click',  () => applySpeed(currentRate + step))

applyBtn.addEventListener('click', () => {
  const val = parseFloat(customInput.value)
  if (isNaN(val) || val <= 0) return
  applySpeed(val)
  customInput.value = ''
})

customInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') applyBtn.click()
})

// ── Inicio ────────────────────────────────────────────────────────────────────
buildPresets()

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) { statusEl.textContent = 'No hay pestaña activa'; statusEl.style.display='block'; return }
  currentTab = tabs[0]

  const url   = currentTab.url || ''
  const isYTM = url.includes('music.youtube.com')
  const isYT  = url.includes('youtube.com')

  if (!isYT) {
    statusEl.textContent   = 'Abre YouTube o YouTube Music'
    statusEl.style.display = 'block'
    return
  }

  nowPlayingEl.textContent = isYTM ? 'YouTube Music' : 'YouTube'

  chrome.tabs.sendMessage(currentTab.id, { type: 'GET_SPEED' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      statusEl.textContent   = 'Recarga la pestaña de YouTube'
      statusEl.style.display = 'block'
      return
    }
    updateUI(res.speed)
  })
})
