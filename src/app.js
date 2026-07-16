import {CAMPAIGN, ageFloor} from './campaign'
import {estimatePulse} from './pulse'
import {track} from './analytics'

const $ = selector => document.querySelector(selector)
const ui = $('#journey')
const shell = $('.shell')
const fallback = $('#robin-3d')
const fallbackModel = fallback?.querySelector('model-viewer')
const statusRegion = $('#journey-status')
const robinControls = $('#robin-controls')
const pulseVideo = $('#pulse-video')
const simulatorPanel = $('#simulator')
const answers = {}
let state = 'loading'
let questionIndex = 0
let pulseBpm = null
let pulseAbort = null
let questionsTracked = false
let modelViewerLoaded = false
let placementTimer = null
const history = []
const params = new URLSearchParams(window.location.search)
const simulatorEnabled = params.get('simulator') === '1'
const simulatorEvents = []

const requestedVariant = params.get('variant')
const variant = (requestedVariant === 'ar' || requestedVariant === '3d')
  ? requestedVariant
  : sessionStorage.getItem('robin-variant') ||
    (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'ar' : '3d')
sessionStorage.setItem('robin-variant', variant)
document.body.dataset.variant = variant

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]
))

const validateCampaign = campaign => {
  if (!campaign.id || !campaign.version || !campaign.verified || !campaign.officialUrl) throw new Error('Campaign metadata is incomplete')
  if (!Array.isArray(campaign.questions) || campaign.questions.length !== 3) throw new Error('Campaign questions are invalid')
  if (!Array.isArray(campaign.screenings) || !campaign.screenings.length) throw new Error('Campaign screenings are invalid')
}

const announce = message => {
  if (!statusRegion) return
  statusRegion.textContent = ''
  requestAnimationFrame(() => { statusRegion.textContent = message })
}

const setStatus = (message = '', kind = 'info') => {
  const chip = $('#status-chip')
  if (!chip) return
  chip.hidden = !message
  chip.dataset.kind = kind
  chip.textContent = message
  if (message) announce(message)
}

const loadModelViewer = () => {
  if (modelViewerLoaded || document.querySelector('script[data-model-viewer]')) return
  modelViewerLoaded = true
  const script = document.createElement('script')
  script.type = 'module'
  script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js'
  script.dataset.modelViewer = 'true'
  document.head.append(script)
}

const setRobinMode = (mode, source = 'assigned') => {
  document.body.dataset.robinMode = mode
  fallback.hidden = mode !== '3d'
  if (mode === '3d') loadModelViewer()
  track('Robin Visible', {variant, capability: mode, source})
  renderSimulator()
}

const render = (html, options = {}) => {
  const {surface = 'sheet', push = true, focus = true} = options
  if (push && ui.innerHTML && history.at(-1) !== state) history.push(state)
  ui.className = `panel panel--${surface}`
  shell.hidden = false
  ui.innerHTML = html
  if (focus) {
    const heading = ui.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      requestAnimationFrame(() => heading.focus({preventScroll: true}))
    }
  }
  renderSimulator()
}

const hideJourney = () => {
  shell.hidden = true
  ui.innerHTML = ''
}

const showUnavailable = () => {
  state = 'unavailable'
  setStatus('')
  render(`
    <p class="eyebrow">Robin screening guide</p>
    <h1>This experience is temporarily unavailable</h1>
    <p>You can still use the official HealthHub screening journey.</p>
    <a class="primary link" href="${CAMPAIGN.officialUrl}" target="_blank" rel="noopener">Open official HealthHub page</a>
  `, {surface: 'conversation', push: false})
}

const showScanning = () => {
  state = 'scanning'
  hideJourney()
  setStatus('Move your phone slowly to find a surface')
  clearTimeout(placementTimer)
  placementTimer = setTimeout(showReadyToPlace, simulatorEnabled ? 300 : 2200)
  renderSimulator()
}

const showReadyToPlace = () => {
  if (!simulatorEnabled && state !== 'scanning' && state !== 'loading') return
  state = 'ready-to-place'
  hideJourney()
  setStatus('Point at the target, then tap to place Robin')
  renderSimulator()
}

const showIntro = ({push = true} = {}) => {
  state = 'introduction'
  setStatus('')
  robinControls.hidden = false
  render(`
    <p class="eyebrow">Meet Robin</p>
    <h1>Let’s look at the bigger picture</h1>
    <p>I can help you explore which general health screenings may be relevant. I won’t diagnose you or confirm eligibility.</p>
    <button class="primary" data-action="pulse-offer">Continue</button>
  `, {surface: 'conversation', push})
}

const showPlaced = () => {
  if (variant !== 'ar' || !['loading', 'scanning', 'ready-to-place'].includes(state)) return
  clearTimeout(placementTimer)
  state = 'placed'
  hideJourney()
  setStatus('Robin is ready')
  track('Robin Placed', {variant})
  setTimeout(() => showIntro({push: false}), simulatorEnabled ? 250 : 950)
}

const showPulseOffer = () => {
  state = 'pulse-offer'
  track('Pulse Offered', {variant})
  render(`
    <p class="eyebrow">Optional</p>
    <h1>Meet your pulse</h1>
    <p>Use your phone camera for a 15-second experimental estimate. It is not a medical measurement and will not affect your screening options.</p>
    <button class="primary" data-action="pulse-start">Estimate my pulse</button>
    <button class="secondary" data-action="questions">Skip this</button>
  `)
}

const pauseAr = async () => {
  try { if (window.XR8 && !XR8.isPaused()) XR8.pause() } catch (_) {}
  await new Promise(resolve => setTimeout(resolve, 350))
}

const resumeAr = async () => {
  if (variant === '3d') return setRobinMode('3d')
  try {
    if (window.XR8 && XR8.isPaused()) XR8.resume()
    await new Promise(resolve => setTimeout(resolve, 900))
    setRobinMode('ar')
  } catch (_) {
    setRobinMode('3d', 'tracking-recovery')
    setStatus('AR could not recover. Continuing in screen-based 3D.', 'warning')
  }
}

const startPulse = async () => {
  state = 'pulse-capture'
  pulseAbort = new AbortController()
  render(`
    <p class="eyebrow">Experimental estimate</p>
    <h1>Cover the rear camera gently</h1>
    <p>Keep your fingertip still. If your phone becomes warm or uncomfortable, stop.</p>
    <progress id="pulse-progress" max="1" value="0"></progress>
    <p id="pulse-status">Preparing camera…</p>
    <button class="secondary" data-action="pulse-cancel">Cancel and continue</button>
  `)
  track('Pulse Started', {variant})
  await pauseAr()
  const result = await estimatePulse(pulseVideo, progress => {
    $('#pulse-progress')?.setAttribute('value', progress)
    const status = $('#pulse-status')
    if (status) status.textContent = `Measuring… ${Math.round(progress * 100)}%`
  }, pulseAbort.signal)
  pulseAbort = null
  if (state !== 'pulse-capture') return
  await resumeAr()
  finishPulse(result)
}

const pulseFailureCopy = {
  'permission-denied': ['Camera permission is off', 'Allow camera access in your browser settings, or continue without a pulse estimate.'],
  'poor-signal': ['The signal was not clear enough', 'Try again with your fingertip covering the camera gently and staying still.'],
  timeout: ['The estimate took too long', 'You can try again, or continue without it.'],
  unavailable: ['Pulse estimate is not available', 'This device cannot use the camera estimate. Your screening guide still works.'],
  cancelled: ['Pulse estimate skipped', 'No problem—this does not affect your screening guide.'],
}

const finishPulse = result => {
  state = 'pulse-result'
  if (result.status === 'estimated') {
    pulseBpm = result.bpm
    fallback.style.setProperty('--pulse-seconds', `${60 / pulseBpm}s`)
    window.dispatchEvent(new CustomEvent('robin-pulse-start', {detail: {bpm: pulseBpm}}))
    track('Pulse Completed', {variant, outcome: 'estimated'})
    render(`
      <p class="eyebrow">Your snapshot</p>
      <h1>About ${pulseBpm} beats per minute</h1>
      <p>This experimental estimate reflects one moment. It is not a medical measurement and does not tell us whether you are healthy or unwell.</p>
      <p><strong>One number is a snapshot. Regular screening helps you understand the bigger picture.</strong></p>
      <button class="primary" data-action="questions">Explore screenings</button>
    `)
    return
  }
  const [title, copy] = pulseFailureCopy[result.reason] || pulseFailureCopy.unavailable
  track('Pulse Failed', {variant, outcome: result.reason})
  render(`
    <p class="eyebrow">Optional pulse estimate</p>
    <h1>${title}</h1>
    <p>${copy}</p>
    ${['poor-signal', 'timeout'].includes(result.reason) ? '<button class="primary" data-action="pulse-start">Try again</button>' : ''}
    <button class="${['poor-signal', 'timeout'].includes(result.reason) ? 'secondary' : 'primary'}" data-action="questions">Continue to screenings</button>
  `)
}

const showQuestion = (index, {push = true} = {}) => {
  questionIndex = Math.max(0, index)
  state = `question-${questionIndex}`
  const question = CAMPAIGN.questions[questionIndex]
  if (!question) return showScreenings()
  render(`
    <div class="sheet-handle" aria-hidden="true"></div>
    <p class="eyebrow">Question ${questionIndex + 1} of ${CAMPAIGN.questions.length}</p>
    <h1>${escapeHtml(question.label)}</h1>
    <div class="choices">
      ${question.options.map(option => `<button class="choice${answers[question.id] === option ? ' is-selected' : ''}" data-question="${question.id}" data-value="${escapeHtml(option)}" data-next="${questionIndex + 1}" aria-pressed="${answers[question.id] === option}">${escapeHtml(option)}</button>`).join('')}
    </div>
    <div class="actions">
      ${questionIndex ? '<button class="secondary" data-action="question-back">Back</button>' : '<button class="secondary" data-action="pulse-offer">Back</button>'}
    </div>
    <p class="privacy">Your answers stay on this device and disappear when the session ends.</p>
  `, {push})
}

const supportGuidance = item => {
  if (answers.support === 'Singapore Citizen') return `${item.support} Subsidies depend on current eligibility; confirm through HealthHub or the provider.`
  if (answers.support === 'Permanent Resident') return 'Subsidies and payment options differ by residency and service. Ask the provider to confirm the current amount before booking.'
  return 'Costs, subsidies and MediSave use depend on eligibility and the specific service. Confirm current information through HealthHub or the provider.'
}

const relevantScreenings = () => {
  const age = ageFloor(answers.age || '18–24')
  const recent = answers.recent
  const priority = ['pressure', 'cardio', 'colorectal', 'measurements']
  return priority
    .map(id => CAMPAIGN.screenings.find(item => item.id === id))
    .filter(item => item && age >= item.minAge)
    .slice(0, 3)
    .map(item => ({
      ...item,
      relevance: recent === 'Yes'
        ? 'May already be up to date—check when it is next due'
        : recent === 'I’m not sure'
          ? 'Check your records or ask a provider when it is due'
          : item.why,
    }))
}

const showScreenings = ({push = true} = {}) => {
  state = 'shortlist'
  if (!questionsTracked) {
    questionsTracked = true
    track('Questions Completed', {variant})
  }
  const items = relevantScreenings()
  render(`
    <div class="sheet-handle" aria-hidden="true"></div>
    <p class="eyebrow">Your screening guide</p>
    <h1>These checks may be relevant</h1>
    <p>Based on your age band and recent screening answer. HealthHub or a clinic must confirm eligibility.</p>
    <div class="screening-list">
      ${items.map(item => `<button class="screening" data-screening="${item.id}"><strong>${item.title}</strong><span>${item.relevance}</span></button>`).join('')}
    </div>
    <button class="secondary" data-action="edit">Edit answers</button>
    <button class="secondary" data-action="ask">Ask Robin a question</button>
  `, {push})
}

const showScreening = id => {
  state = `screening-${id}`
  const item = CAMPAIGN.screenings.find(entry => entry.id === id)
  if (!item) return showScreenings()
  track('Screening Explored', {variant, screening: id})
  render(`
    <div class="sheet-handle" aria-hidden="true"></div>
    <p class="eyebrow">May be relevant</p>
    <h1>${item.title}</h1>
    <h2>Why it may matter</h2><p>${item.why}</p>
    <h2>What it checks</h2><p>${item.check}</p>
    <h2>What to expect</h2><p>${item.expect}</p>
    <h2>Cost, support and MediSave</h2><p>${supportGuidance(item)}</p>
    <p class="source">Guidance version ${CAMPAIGN.version}; verified ${CAMPAIGN.verified}.</p>
    <a class="primary link" href="${CAMPAIGN.officialUrl}" target="_blank" rel="noopener" data-official="${id}">Open official HealthHub page <span aria-hidden="true">↗</span></a>
    <button class="secondary" data-action="screenings">Back to my list</button>
  `, {surface: 'detail'})
}

const intents = [
  {pattern: /medisave|claim|pay|cost|price|subsid/i, answer: 'General screening packages are not automatically MediSave-claimable. Selected tests or follow-up procedures may qualify, and subsidies depend on eligibility. HealthHub or the provider should confirm current costs and support.'},
  {pattern: /fast|eat|drink|prepare/i, answer: 'Some blood tests may be fasting or non-fasting. Ask the clinic which test is planned before changing what you eat or drink.'},
  {pattern: /where|clinic|location|book|appointment/i, answer: 'Healthier SG screening is available through participating providers. Use the official HealthHub journey when you are ready to verify eligibility or arrange a screening.'},
  {pattern: /result|positive|follow.?up|abnormal/i, answer: 'A screening result may lead to a follow-up discussion or another test. The clinic will explain the appropriate next step; Robin does not interpret results.'},
]

const showAsk = (answer = '') => {
  state = 'ask'
  render(`
    <div class="sheet-handle" aria-hidden="true"></div>
    <p class="eyebrow">Ask Robin</p>
    <h1>What would you like to know?</h1>
    <div class="chips">
      <button data-query="Can I use MediSave?">Can I use MediSave?</button>
      <button data-query="Do I need to fast?">Do I need to fast?</button>
      <button data-query="Where can I go?">Where can I go?</button>
    </div>
    <form id="question-form">
      <label for="question-input">Type a general question</label>
      <input id="question-input" maxlength="160" autocomplete="off">
      <button class="primary" type="submit">Ask</button>
    </form>
    ${answer ? `<div class="answer">${escapeHtml(answer)}</div>` : ''}
    <button class="secondary" data-action="screenings">Back to my list</button>
  `)
}

const answerQuestion = query => {
  const match = intents.find(intent => intent.pattern.test(query))
  track(match ? 'Intent Matched' : 'Intent Unmatched', {variant, outcome: match ? 'matched' : 'unmatched'})
  showAsk(match?.answer || 'I can’t confirm that safely. Try asking about cost, MediSave, preparation, results, or where to go—or verify it through official HealthHub guidance.')
}

const resetJourney = () => {
  Object.keys(answers).forEach(key => delete answers[key])
  pulseBpm = null
  questionsTracked = false
  history.length = 0
  simulatorEvents.length = 0
  robinControls.hidden = true
  if (variant === '3d') start3d()
  else showScanning()
}

const renderSimulator = () => {
  if (!simulatorEnabled || !simulatorPanel) return
  simulatorPanel.hidden = false
  const eventText = simulatorEvents.slice(-6).map(event => `${event.name} ${JSON.stringify(event.props)}`).join('\n')
  simulatorPanel.innerHTML = `
    <div class="simulator__head"><h2>Robin Simulator</h2><button data-sim="collapse" aria-label="Collapse simulator">−</button></div>
    <p><strong>State:</strong> ${escapeHtml(state)} · <strong>Mode:</strong> ${escapeHtml(document.body.dataset.robinMode || '')} · <strong>Pulse:</strong> ${pulseBpm || 'none'}</p>
    <div class="simulator__grid">
      <button data-sim="loading">Loading</button><button data-sim="scanning">Scanning</button>
      <button data-sim="ready">Ready to place</button><button data-sim="placed">Placed</button>
      <button data-sim="model-failed">Model failure</button><button data-sim="lost">Tracking lost</button>
      <button data-sim="recovered">Recovery success</button><button data-sim="recovery-failed">3D fallback</button>
      <select id="sim-bpm" aria-label="Simulated BPM"><option>60</option><option selected>72</option><option>90</option><option>120</option></select>
      <button data-sim="pulse-success">Pulse success</button>
      <button data-sim="poor-signal">Poor signal</button><button data-sim="permission-denied">Permission denied</button>
      <button data-sim="cancelled">Pulse cancelled</button><button data-sim="timeout">Pulse timeout</button>
      <button data-sim="reset">Reset session</button>
    </div>
    <pre aria-label="Simulator event log">${escapeHtml(eventText || 'No events yet')}</pre>
  `
}

simulatorPanel?.addEventListener('click', event => {
  const action = event.target.closest('[data-sim]')?.dataset.sim
  if (!action) return
  if (action === 'collapse') simulatorPanel.classList.toggle('is-collapsed')
  if (action === 'loading') showLoading()
  if (action === 'scanning') showScanning()
  if (action === 'ready') showReadyToPlace()
  if (action === 'placed') showPlaced()
  if (action === 'lost') setStatus('Tracking lost. Move slowly back toward the surface.', 'warning')
  if (action === 'recovered') { setRobinMode('ar', 'tracking-recovery'); setStatus('Tracking restored') }
  if (action === 'recovery-failed') { setRobinMode('3d', 'tracking-recovery'); setStatus('Continuing in screen-based 3D', 'warning') }
  if (action === 'model-failed') showModelFailure()
  if (action === 'pulse-success') finishPulse({status: 'estimated', bpm: Number($('#sim-bpm')?.value || 72)})
  if (['poor-signal', 'permission-denied', 'cancelled', 'timeout'].includes(action)) finishPulse({status: 'failed', reason: action})
  if (action === 'reset') resetJourney()
  renderSimulator()
})

window.addEventListener('robin-analytics', event => {
  if (!simulatorEnabled) return
  simulatorEvents.push(event.detail)
  renderSimulator()
})

ui.addEventListener('click', event => {
  const target = event.target.closest('button, a')
  if (!target) return
  if (target.dataset.action === 'pulse-offer') showPulseOffer()
  if (target.dataset.action === 'pulse-start') startPulse()
  if (target.dataset.action === 'pulse-cancel') pulseAbort?.abort()
  if (target.dataset.action === 'questions') showQuestion(0)
  if (target.dataset.action === 'question-back') showQuestion(questionIndex - 1, {push: false})
  if (target.dataset.action === 'screenings') showScreenings({push: false})
  if (target.dataset.action === 'edit') {
    track('Answers Edited', {variant})
    showQuestion(0)
  }
  if (target.dataset.action === 'ask') showAsk()
  if (target.dataset.question) {
    answers[target.dataset.question] = target.dataset.value
    showQuestion(Number(target.dataset.next))
  }
  if (target.dataset.screening) showScreening(target.dataset.screening)
  if (target.dataset.query) answerQuestion(target.dataset.query)
  if (target.dataset.official) track('Official Action Selected', {variant, screening: target.dataset.official})
})

ui.addEventListener('submit', event => {
  if (event.target.id !== 'question-form') return
  event.preventDefault()
  const query = $('#question-input').value.trim()
  if (query) answerQuestion(query)
})

window.addEventListener('robin-placed', showPlaced)
window.addEventListener('robin-open-cards', () => {
  if (['scanning', 'ready-to-place', 'placed'].includes(state)) return
  shell.hidden = false
  announce('Robin guide opened')
})
window.addEventListener('robin-reset', resetJourney)
robinControls?.addEventListener('click', event => {
  const direction = Number(event.target.closest('[data-rotate]')?.dataset.rotate || 0)
  if (!direction) return
  if (document.body.dataset.robinMode === '3d' && fallbackModel) {
    const orbit = fallbackModel.getCameraOrbit?.()
    if (orbit) fallbackModel.cameraOrbit = `${orbit.theta + direction * Math.PI / 8}rad ${orbit.phi}rad ${orbit.radius}m`
  }
  window.dispatchEvent(new CustomEvent('robin-rotate', {detail: {direction}}))
})

fallbackModel?.addEventListener('load', () => {
  if (state !== 'model-loading') return
  track('Model Loaded', {variant})
  setStatus('')
  setTimeout(() => showIntro({push: false}), 250)
})
fallbackModel?.addEventListener('error', () => showModelFailure())

const showModelFailure = () => {
  state = 'model-failure'
  track('Model Failed', {variant})
  fallback.classList.add('is-static')
  setStatus('Robin’s 3D model could not load. The guide is still available.', 'warning')
  showIntro({push: false})
}

const start3d = () => {
  state = 'model-loading'
  hideJourney()
  setRobinMode('3d')
  setStatus('Loading Robin…')
  if (fallbackModel?.getAttribute('loaded') !== null) setTimeout(() => showIntro({push: false}), 400)
  else setTimeout(() => {
    if (state === 'model-loading') showModelFailure()
  }, simulatorEnabled ? 1500 : 8000)
}

const showLoading = () => {
  state = 'loading'
  hideJourney()
  setStatus(variant === 'ar' ? 'Starting camera…' : 'Preparing Robin…')
  robinControls.hidden = true
  track('Loading Started', {variant})
}

try {
  validateCampaign(CAMPAIGN)
  track('Session Start', {variant})
  showLoading()
  if (variant === '3d') {
    const releaseArCamera = () => setTimeout(() => {
      try { if (window.XR8 && !XR8.isPaused()) XR8.pause() } catch (_) {}
    }, 350)
    window.XR8 ? releaseArCamera() : window.addEventListener('xrloaded', releaseArCamera, {once: true})
    start3d()
  } else {
    setRobinMode('ar')
    window.addEventListener('xrloaded', showScanning, {once: true})
    setTimeout(() => { if (state === 'loading') showScanning() }, simulatorEnabled ? 400 : 3000)
  }
} catch (error) {
  console.error(error)
  showUnavailable()
}
