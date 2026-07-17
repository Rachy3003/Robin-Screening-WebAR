import {CAMPAIGN, ageFloor} from './campaign'
import {CALCULATOR_RULES, calculateSnapshot, formatCalories} from './calculator-rules.mjs'
import {track} from './analytics'

const $ = selector => document.querySelector(selector)
const ui = $('#journey')
const shell = $('.shell')
const fallback = $('#robin-3d')
const fallbackModel = fallback?.querySelector('model-viewer')
const statusRegion = $('#journey-status')
const robinControls = $('#robin-controls')
const arFallbackButton = $('#ar-fallback')
const arToggle = $('#ar-toggle')
const simulatorPanel = $('#simulator')
const answers = {}
const calculator = {adult: null, profile: null, age: 35, ageBand: '30-59', heightCm: 168, weightKg: 65, activity: null}
const spatialPrompt = $('#spatial-prompt')
let closedState = null
let closedMarkup = ''
let closedPanelClass = ''
let idleTimers = []
let screeningPage = 0
let sheetCollapsed = false
let sheetScrollTop = 0
let state = 'loading'
let questionIndex = 0
let questionsTracked = false
let modelViewerLoaded = false
let fallbackOfferTimer = null
let instrumentCleanup = null
let calculatorTracked = false
let calculatorStarted = false
let restoringHistory = false
const params = new URLSearchParams(window.location.search)
const simulatorEnabled = params.get('simulator') === '1'
const simulatorUiHidden = params.get('simulator-ui') === '0'
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
  if (!Array.isArray(campaign.questions) || !campaign.questions.length) throw new Error('Campaign questions are invalid')
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
  if (arToggle) {
    const enabled = mode === 'ar'
    arToggle.setAttribute('aria-pressed', String(enabled))
    arToggle.setAttribute('aria-label', enabled ? 'AR is on. Switch to screen-based 3D' : 'AR is off. Place Robin in my space')
  }
  track('Robin Visible', {variant, capability: mode, source})
  renderSimulator()
}

const render = (html, options = {}) => {
  const {surface = 'sheet', push = true, focus = true} = options
  if (state.startsWith('calculator')) setStatus('')
  if (push && !restoringHistory && window.history.state?.robinState !== state) {
    window.history.pushState({robinState: state}, '')
  }
  ui.className = `panel panel--${surface}`
  sheetCollapsed = false
  shell.hidden = false
  stopIdlePrompts()
  const content = html.replaceAll('<div class="sheet-handle" aria-hidden="true"></div>', '')
  ui.innerHTML = `<button class="sheet-handle" data-action="toggle-sheet" aria-expanded="true" aria-label="Minimise this panel"></button><picture class="robin-sheet-portrait-frame"><source srcset="./assets/robin-portrait.avif" type="image/avif"><source srcset="./assets/robin-portrait.webp" type="image/webp"><img class="robin-sheet-portrait" src="./assets/robin-portrait.png" alt="" aria-hidden="true"></picture>${content}<div class="panel-tools"><button data-action="mode-menu" aria-label="Experience options">•••</button><button data-action="close" aria-label="Close and see Robin">×</button></div>`
  ui.querySelector('.sheet-handle')?.addEventListener('click', event => {
    event.stopPropagation()
    toggleSheet()
  })
  requestAnimationFrame(updateViewportLayout)
  if (focus) {
    const heading = ui.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      requestAnimationFrame(() => heading.focus({preventScroll: true}))
    }
  }
  renderSimulator()
}

const toggleSheet = forceExpanded => {
  const expand = forceExpanded === true || (forceExpanded !== false && sheetCollapsed)
  if (!expand) sheetScrollTop = ui.scrollTop
  sheetCollapsed = !expand
  ui.classList.toggle('is-collapsed', sheetCollapsed)
  const handle = ui.querySelector('.sheet-handle')
  handle?.setAttribute('aria-expanded', String(!sheetCollapsed))
  handle?.setAttribute('aria-label', sheetCollapsed ? 'Expand this panel' : 'Minimise this panel')
  if (sheetCollapsed) ui.scrollTop = 0
  else requestAnimationFrame(() => { ui.scrollTop = sheetScrollTop })
  announce(sheetCollapsed ? 'Panel minimised' : 'Panel expanded')
  requestAnimationFrame(updateViewportLayout)
  renderSimulator()
}

const updateViewportLayout = () => {
  const height = window.visualViewport?.height || window.innerHeight
  document.documentElement.style.setProperty('--visual-height', `${height}px`)
  const sheetHeight = shell.hidden ? 0 : Math.min(ui.getBoundingClientRect().height, height * .78)
  document.documentElement.style.setProperty('--sheet-height', `${sheetHeight}px`)
  const robinIsCovered = !shell.hidden && !sheetCollapsed && sheetHeight >= height * .52
  ui.classList.toggle('has-robin-portrait', robinIsCovered)
}

const stopIdlePrompts = () => {
  idleTimers.forEach(clearTimeout)
  idleTimers = []
  if (spatialPrompt) spatialPrompt.hidden = true
}

const showPrompt = (step) => {
  if (!spatialPrompt || !shell.hidden) return
  const prompts = [
    `<p>How can I help?</p><button class="primary" data-prompt="ask">Ask Robin a question</button>`,
    `<p>Would you like to explore HealthHub?</p><a class="primary link" href="https://www.healthhub.sg/" target="_blank" rel="noopener">Visit HealthHub</a>`,
    `<p>Take HealthHub with you</p><div class="store-links"><a href="https://apps.apple.com/sg/app/healthhub-sg/id1034200875"><img src="./assets/apple-app-store.png" alt="Download on the App Store"></a><a href="https://play.google.com/store/apps/details?id=sg.gov.hpb.healthhub"><img src="./assets/google-play.png" alt="Get it on Google Play"></a></div>`,
  ]
  spatialPrompt.innerHTML = prompts[step]
  spatialPrompt.hidden = false
}

const startIdlePrompts = () => {
  stopIdlePrompts()
  const sequence = []
  for (let loop = 0; loop < 2; loop++) {
    const base = 3000 + loop * 25000
    sequence.push([base, 0], [base + 3000, 1], [base + 6000, 2], [base + 12000, -1])
  }
  sequence.forEach(([delay, step]) => idleTimers.push(setTimeout(() => {
    if (!shell.hidden) return
    if (step < 0) spatialPrompt.hidden = true
    else showPrompt(step)
  }, simulatorEnabled ? Math.max(150, delay / 12) : delay)))
}

const closeJourney = () => {
  closedState = state
  closedMarkup = ui.innerHTML
  closedPanelClass = ui.className
  hideJourney()
  setStatus('Photo mode — tap Robin to resume')
  startIdlePrompts()
  track('Journey Closed', {variant, state: closedState})
}

const resumeJourney = () => {
  stopIdlePrompts()
  setStatus('')
  if (closedMarkup) {
    ui.innerHTML = closedMarkup
    ui.className = closedPanelClass
  }
  shell.hidden = false
  announce('Resumed where you left off')
}

const showModeMenu = () => {
  const current = document.body.dataset.robinMode || 'ar'
  if (!closedMarkup || state !== 'mode-menu') {
    closedState = state
    closedMarkup = ui.innerHTML
    closedPanelClass = ui.className
  }
  state = 'mode-menu'
  render(`
    <p class="eyebrow">Experience options</p><h1>Choose how Robin appears</h1>
    <p>Your progress will stay exactly where it is.</p>
    <div class="mode-menu">
      <button class="primary" data-mode="${current === 'ar' ? '3d' : 'ar'}">${current === 'ar' ? 'Use screen-based 3D' : 'Place Robin in my space'}</button>
      ${current === 'ar' ? '<button class="secondary" data-action="move-robin">Move Robin</button>' : ''}
      <button class="secondary" data-action="resume">Back</button>
    </div>
  `, {surface: 'conversation'})
}

const preserveJourney = () => {
  if (shell.hidden || state === 'mode-menu') return
  closedState = state
  closedMarkup = ui.innerHTML
  closedPanelClass = ui.className
}

const switchRobinMode = mode => {
  preserveJourney()
  if (mode === '3d') {
    try { if (window.XR8 && !XR8.isPaused()) XR8.pause() } catch (_) {}
    setRobinMode('3d', 'user-selected')
    setStatus('Screen-based 3D is on')
    if (closedMarkup) resumeJourney()
    requestAnimationFrame(updateViewportLayout)
    return
  }
  setRobinMode('ar', 'user-selected')
  try { if (window.XR8?.isPaused()) XR8.resume() } catch (_) {}
  showScanning()
}

const hideJourney = () => {
  shell.hidden = true
  ui.innerHTML = ''
  requestAnimationFrame(updateViewportLayout)
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
  if (variant !== 'ar' || state === 'placed') return
  state = 'scanning'
  hideJourney()
  setStatus('Move your phone slowly to find a surface')
  arFallbackButton.hidden = true
  clearTimeout(fallbackOfferTimer)
  fallbackOfferTimer = setTimeout(() => {
    if (!['loading', 'scanning'].includes(state)) return
    arFallbackButton.hidden = false
    announce('Still scanning. You can continue without AR if you prefer.')
  }, simulatorEnabled ? 500 : 20000)
  renderSimulator()
}

const showReadyToPlace = () => {
  if (variant !== 'ar' || (!simulatorEnabled && state !== 'scanning' && state !== 'loading')) return
  clearTimeout(fallbackOfferTimer)
  arFallbackButton.hidden = true
  state = 'ready-to-place'
  hideJourney()
  setStatus('Surface found. Tap the target to place Robin')
  renderSimulator()
}

const showPlacementMissed = () => {
  if (variant !== 'ar' || state !== 'ready-to-place') return
  setStatus('No surface at that spot yet. Move slowly, point at the target, and tap again.', 'warning')
  track('Placement Missed', {variant})
}

const showIntro = ({push = true} = {}) => {
  state = 'introduction'
  setStatus('')
  robinControls.hidden = false
  render(`
    <p class="eyebrow">Meet Robin</p>
    <h1>Let’s look at the bigger picture</h1>
    <p>I can help you explore which general health screenings may be relevant. I won’t diagnose you or confirm eligibility.</p>
    <button class="primary" data-action="calculator-offer">Continue</button>
  `, {surface: 'conversation', push})
}

const showPlaced = () => {
  if (variant !== 'ar' || !['loading', 'scanning', 'ready-to-place'].includes(state)) return
  clearTimeout(fallbackOfferTimer)
  arFallbackButton.hidden = true
  state = 'placed'
  hideJourney()
  setStatus('Robin is ready')
  track('Robin Placed', {variant})
  setTimeout(() => closedMarkup ? resumeJourney() : showIntro({push: false}), simulatorEnabled ? 350 : 3000)
}

const calculatorProgress = (step, total = 7) => `
  <div class="calculator-progress" aria-label="Step ${step} of ${total}">
    <span>Step ${step} of ${total}</span><div><i style="--progress:${step / total * 100}%"></i></div>
  </div>`

const calculatorBack = action => `<button class="secondary" data-action="${action}">Back</button>`

const cueRobin = cue => {
  fallback.dataset.cue = cue
  setTimeout(() => { if (fallback.dataset.cue === cue) delete fallback.dataset.cue }, 420)
  window.dispatchEvent(new CustomEvent('robin-calculator-cue', {detail: {cue}}))
}

const showCalculatorOffer = () => {
  state = 'calculator-offer'
  setStatus('')
  track('Calculator Offered', {variant})
  cueRobin('calculator-offer')
  render(`
    <p class="eyebrow">Optional</p>
    <h1>Know your health numbers</h1>
    <p>Use Robin's interactive tools to estimate your BMI and daily calorie needs. It takes about a minute and does not change your screening options.</p>
    <button class="primary" data-action="calculator-start">Start calculator</button>
    <button class="secondary" data-action="calculator-skip">Skip to screening guide</button>
  `)
}

const showAdultCheck = () => {
  state = 'calculator-adult'
  if (!calculatorStarted) {
    calculatorStarted = true
    track('Calculator Started', {variant})
  }
  render(`
    ${calculatorProgress(1)}
    <h1>Are you 18 or older?</h1>
    <p>This calculator uses adult BMI and calorie guidance.</p>
    <div class="choices">
      <button class="choice" data-calc="adult" data-value="yes">Yes, I am 18 or older</button>
      <button class="choice" data-calc="adult" data-value="no">No, I am under 18</button>
    </div>
    ${calculatorBack('calculator-offer')}
  `)
}

const showUnder18 = () => {
  state = 'calculator-under18'
  render(`
    <p class="eyebrow">Age-appropriate guidance</p>
    <h1>Adult calculations aren't the right fit yet</h1>
    <p>Health needs change as you grow. Use HealthHub's nutrition guidance for your age, or continue with Robin's general screening guide.</p>
    <a class="primary link" href="${CALCULATOR_RULES.under18Url}" target="_blank" rel="noopener" data-under18>Open HealthHub nutrition guidance <span aria-hidden="true">↗</span></a>
    <button class="secondary" data-action="questions">Continue to screening guide</button>
    ${calculatorBack('calculator-adult')}
  `)
}

const showCalculationProfile = () => {
  state = 'calculator-profile'
  render(`
    ${calculatorProgress(2)}
    <h1>Which option should we use?</h1>
    <p>This is used only by the calorie equation and may not reflect your gender identity.</p>
    <div class="choices">
      ${[['male', 'Male'], ['female', 'Female'], ['prefer-not', 'Prefer not to say']].map(([value, label]) => `<button class="choice${calculator.profile === value ? ' is-selected' : ''}" data-calc="profile" data-value="${value}" aria-pressed="${calculator.profile === value}">${label}</button>`).join('')}
    </div>
    ${calculatorBack('calculator-adult')}
  `)
}

const showAgeBand = () => {
  state = 'calculator-age'
  render(`
    ${calculatorProgress(3)}
    <h1>Set your age</h1>
    <p>Turn the dial once. Robin will use it for both calculations and screening guidance.</p>
    <div class="weight-instrument">
      ${instrumentButton('age', -1, 'Decrease age by one year')}
      <div id="age-dial" class="weight-dial" data-dial-field="age" role="slider" tabindex="0" aria-label="Age in years" aria-valuemin="18" aria-valuemax="100" aria-valuenow="${calculator.age}" style="--dial-angle:${-125 + ((calculator.age - 18) / 82) * 250}deg">
        <div class="dial-ticks" aria-hidden="true"></div><i aria-hidden="true"></i>
        <output><strong>${calculator.age}</strong><span>years</span></output>
      </div>
      ${instrumentButton('age', 1, 'Increase age by one year')}
    </div>
    <button class="primary" data-action="calculator-height">Continue</button>
    ${calculatorBack('calculator-profile')}
  `)
  bindInstruments()
}

const instrumentButton = (field, direction, label) => `<button class="instrument-step" data-adjust="${field}" data-direction="${direction}" aria-label="${label}">${direction < 0 ? '−' : '+'}</button>`

const showHeightInstrument = () => {
  state = 'calculator-height'
  cueRobin('measure-height')
  render(`
    ${calculator.profile === 'prefer-not' ? calculatorProgress(3, 4) : calculatorProgress(4)}
    <h1>Set your height</h1>
    <p>Slide the measuring tape until it matches your height.</p>
    <div class="height-instrument">
      ${instrumentButton('heightCm', -1, 'Decrease height by one centimetre')}
      <div class="height-ruler">
        <input id="height-control" class="height-control" type="range" min="50" max="250" step="1" value="${calculator.heightCm}" aria-label="Height in centimetres">
        <output id="height-output" for="height-control"><strong>${calculator.heightCm}</strong><span>cm</span></output>
      </div>
      ${instrumentButton('heightCm', 1, 'Increase height by one centimetre')}
    </div>
    <button class="primary" data-action="calculator-weight">Continue</button>
    ${calculatorBack(calculator.profile === 'prefer-not' ? 'calculator-profile' : 'calculator-age')}
  `)
  bindInstruments()
}

const weightRotation = value => -125 + ((value - 25) / 225) * 250

const showWeightDial = () => {
  state = 'calculator-weight'
  cueRobin('turn-weight-dial')
  render(`
    ${calculator.profile === 'prefer-not' ? calculatorProgress(4, 4) : calculatorProgress(5)}
    <h1>Turn the weight dial</h1>
    <p>Drag around the dial until it shows your weight.</p>
    <div class="weight-instrument">
      ${instrumentButton('weightKg', -1, 'Decrease weight by one kilogram')}
      <div id="weight-dial" class="weight-dial" data-dial-field="weightKg" role="slider" tabindex="0" aria-label="Weight in kilograms" aria-valuemin="25" aria-valuemax="250" aria-valuenow="${calculator.weightKg}" style="--dial-angle:${weightRotation(calculator.weightKg)}deg">
        <div class="dial-ticks" aria-hidden="true"></div><i aria-hidden="true"></i>
        <output id="weight-output"><strong>${calculator.weightKg}</strong><span>kg</span></output>
      </div>
      ${instrumentButton('weightKg', 1, 'Increase weight by one kilogram')}
    </div>
    <button class="primary" data-action="${calculator.profile === 'prefer-not' ? 'calculator-result' : 'calculator-activity'}">${calculator.profile === 'prefer-not' ? 'See my BMI' : 'Continue'}</button>
    ${calculatorBack('calculator-height')}
  `)
  bindInstruments()
}

const showActivity = () => {
  state = 'calculator-activity'
  const options = [
    ['lvl1', 'Mostly inactive', 'Mostly sitting with little planned activity'],
    ['lvl2', 'Somewhat active', 'Light activity or exercise a few times a week'],
    ['lvl3', 'Active', 'Moderate activity or exercise most days'],
    ['lvl4', 'Very active', 'Hard activity, training or physical work most days'],
  ]
  render(`
    ${calculatorProgress(6)}
    <h1>How active is a typical day?</h1>
    <div class="choices activity-choices">
      ${options.map(([value, label, description]) => `<button class="choice${calculator.activity === value ? ' is-selected' : ''}" data-calc="activity" data-value="${value}" aria-pressed="${calculator.activity === value}"><strong>${label}</strong><span>${description}</span></button>`).join('')}
    </div>
    ${calculatorBack('calculator-weight')}
  `)
}

const bmiMarkerPosition = bmi => Math.max(4, Math.min(96, ((bmi - 15) / 17.5) * 100))

const showCalculatorResult = () => {
  state = 'calculator-result'
  setStatus('')
  let snapshot
  try {
    snapshot = calculateSnapshot(calculator)
  } catch (_) {
    return showCalculatorFailure()
  }
  cueRobin('reveal-result')
  if (!calculatorTracked) {
    calculatorTracked = true
    track('Calculator Completed', {variant})
  }
  const calories = snapshot.recommended && (snapshot.recommended.low === snapshot.recommended.high
    ? `${formatCalories(snapshot.recommended.low)} kcal`
    : `${formatCalories(snapshot.recommended.low)}–${formatCalories(snapshot.recommended.high)} kcal`)
  render(`
    <div class="snapshot-robin" aria-hidden="true"><span>Snapshot ready!</span></div>
    <p class="eyebrow">Your bigger picture</p>
    <h1 class="snapshot-number">${snapshot.bmi} <small>BMI</small></h1>
    <p>This falls in HealthHub's <strong>${snapshot.classification.label}</strong> range: ${snapshot.classification.risk.toLowerCase()}.</p>
    <div class="bmi-scale" role="img" aria-label="BMI ${snapshot.bmi}, ${snapshot.classification.risk}">
      <i style="--marker:${bmiMarkerPosition(snapshot.bmi)}%"><span>You</span></i>
      <div><span></span><span></span><span></span><span></span></div>
      <ol><li>&lt;18.5</li><li>18.5</li><li>23</li><li>27.5+</li></ol>
    </div>
    ${calories ? `<div class="snapshot-grid"><div><span>${snapshot.classification.calorieLabel}</span><strong>${calories}</strong></div><div><span>Activity</span><strong>${escapeHtml(activityLabel(calculator.activity))}</strong></div></div>` : '<div class="snapshot-grid snapshot-grid--single"><div><span>Calorie estimate</span><strong>Not calculated</strong><small>A calculation profile is required.</small></div></div>'}
    ${snapshot.classification.context ? `<p class="health-note"><strong>Worth knowing:</strong> ${snapshot.classification.context}</p>` : ''}
    <p class="health-note">BMI is a screening indicator, not a diagnosis. Pregnancy, muscle mass and some health conditions can affect what it means.</p>
    <p><strong>This is one useful indicator—not the whole picture.</strong></p>
    <button class="primary" data-action="questions">See my screening guide</button>
    <button class="secondary" data-action="calculator-height" data-edit-result>Adjust my dials</button>
    <a class="secondary link" href="${CALCULATOR_RULES.sourceUrl}" target="_blank" rel="noopener" data-calculator-official>Open official HealthHub calculator <span aria-hidden="true">↗</span></a>
    <p class="source">Calculation rules verified ${CALCULATOR_RULES.verified}.</p>
  `, {surface: 'detail'})
}

const activityLabel = value => ({lvl1: 'Mostly inactive', lvl2: 'Somewhat active', lvl3: 'Active', lvl4: 'Very active'}[value] || '')

const showCalculatorFailure = () => {
  state = 'calculator-failure'
  track('Calculator Failed', {variant, outcome: 'calculation'})
  render(`
    <p class="eyebrow">Calculator unavailable</p>
    <h1>Let's continue without a result</h1>
    <p>Your screening guide still works, and none of your calculator details were saved.</p>
    <button class="primary" data-action="questions">Continue to screening guide</button>
    <button class="secondary" data-action="calculator-height">Try the calculator again</button>
  `)
}

const updateInstrument = (field, value) => {
  const limits = field === 'age' ? {min: 18, max: 100} : field === 'heightCm' ? CALCULATOR_RULES.limits.height : CALCULATOR_RULES.limits.weight
  calculator[field] = Math.max(limits.min, Math.min(limits.max, Math.round(Number(value))))
  if (field === 'age') {
    calculator.ageBand = calculator.age < 30 ? '18-29' : calculator.age < 60 ? '30-59' : '60+'
    const dial = $('#age-dial')
    dial?.style.setProperty('--dial-angle', `${-125 + ((calculator.age - 18) / 82) * 250}deg`)
    dial?.setAttribute('aria-valuenow', calculator.age)
    const output = dial?.querySelector('output strong')
    if (output) output.textContent = calculator.age
    return
  }
  const output = field === 'heightCm' ? $('#height-output') : $('#weight-output')
  if (output) output.querySelector('strong').textContent = calculator[field]
  if (field === 'weightKg') {
    const dial = $('#weight-dial')
    dial?.style.setProperty('--dial-angle', `${weightRotation(calculator.weightKg)}deg`)
    dial?.setAttribute('aria-valuenow', calculator.weightKg)
  } else {
    const height = $('#height-control')
    if (height) height.value = calculator.heightCm
  }
}

const bindInstruments = () => {
  instrumentCleanup?.()
  const height = $('#height-control')
  const dial = $('[data-dial-field]')
  const cleanups = []
  if (height) {
    const onInput = () => updateInstrument('heightCm', height.value)
    height.addEventListener('input', onInput)
    cleanups.push(() => height.removeEventListener('input', onInput))
  }
  if (dial) {
    const field = dial.dataset.dialField
    const limits = field === 'age' ? {min: 18, max: 100} : CALCULATOR_RULES.limits.weight
    const setFromPointer = event => {
      const rect = dial.getBoundingClientRect()
      const degrees = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI + 90
      const normalized = Math.max(-125, Math.min(125, degrees > 180 ? degrees - 360 : degrees))
      updateInstrument(field, limits.min + ((normalized + 125) / 250) * (limits.max - limits.min))
    }
    const move = event => { if (dial.hasPointerCapture(event.pointerId)) { event.preventDefault(); setFromPointer(event) } }
    const down = event => { event.preventDefault(); dial.setPointerCapture(event.pointerId); setFromPointer(event) }
    const release = event => { if (dial.hasPointerCapture(event.pointerId)) dial.releasePointerCapture(event.pointerId) }
    const key = event => {
      if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) return
      event.preventDefault()
      updateInstrument(field, calculator[field] + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1))
    }
    dial.addEventListener('pointerdown', down); dial.addEventListener('pointermove', move); dial.addEventListener('pointerup', release); dial.addEventListener('pointercancel', release); dial.addEventListener('keydown', key)
    cleanups.push(() => { dial.removeEventListener('pointerdown', down); dial.removeEventListener('pointermove', move); dial.removeEventListener('pointerup', release); dial.removeEventListener('pointercancel', release); dial.removeEventListener('keydown', key) })
  }
  instrumentCleanup = () => cleanups.forEach(cleanup => cleanup())
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
      ${questionIndex ? '<button class="secondary" data-action="question-back">Back</button>' : '<button class="secondary" data-action="calculator-offer">Back</button>'}
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
  const age = ageFloor(calculator.age)
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
    <p>Based on age ${calculator.age} and your recent screening answer. HealthHub or a clinic must confirm eligibility.</p>
    <div class="screening-list">
      ${items.map(item => `<button class="screening" data-screening="${item.id}"><strong>${item.title}</strong><span>${item.relevance}</span></button>`).join('')}
    </div>
    <button class="secondary" data-action="edit">Edit answers</button>
    <button class="secondary" data-action="ask">Ask Robin a question</button>
  `, {push})
}

const showScreening = (id, page = 0) => {
  state = `screening-${id}`
  screeningPage = Math.max(0, Math.min(3, page))
  const item = CAMPAIGN.screenings.find(entry => entry.id === id)
  if (!item) return showScreenings()
  track('Screening Explored', {variant, screening: id})
  const pages = [
    ['Why it may matter', item.why],
    ['What it checks', item.check],
    ['What to expect', item.expect],
    ['Official next step', 'HealthHub can confirm current eligibility and help you take the next step when you are ready.'],
  ]
  const [title, content] = pages[screeningPage]
  render(`
    <div class="sheet-handle" aria-hidden="true"></div>
    <p class="eyebrow">May be relevant · ${screeningPage + 1} of 4</p>
    <h1>${item.title}</h1>
    <h2>${title}</h2><p>${content}</p>
    ${screeningPage === 3 ? `<a class="primary link" href="${CAMPAIGN.officialUrl}" target="_blank" rel="noopener" data-official="${id}">Open official HealthHub page <span aria-hidden="true">↗</span></a>` : `<button class="primary" data-screening-page="${id}" data-page="${screeningPage + 1}">Next</button>`}
    <button class="secondary" data-action="ask">Ask Robin</button>
    <button class="secondary" data-action="${screeningPage ? 'screening-back' : 'screenings'}" data-screening-id="${id}">Back</button>
  `)
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
  Object.assign(calculator, {adult: null, profile: null, age: 35, ageBand: '30-59', heightCm: 168, weightKg: 65, activity: null})
  questionsTracked = false
  calculatorTracked = false
  calculatorStarted = false
  simulatorEvents.length = 0
  robinControls.hidden = true
  if (variant === '3d') start3d()
  else showScanning()
}

const renderSimulator = () => {
  if (!simulatorEnabled || !simulatorPanel) return
  simulatorPanel.hidden = simulatorUiHidden
  const eventText = simulatorEvents.slice(-6).map(event => `${event.name} ${JSON.stringify(event.props)}`).join('\n')
  simulatorPanel.innerHTML = `
    <div class="simulator__head"><h2>Robin Simulator</h2><button data-sim="collapse" aria-label="Collapse simulator">−</button></div>
    <p><strong>State:</strong> ${escapeHtml(state)} · <strong>Mode:</strong> ${escapeHtml(document.body.dataset.robinMode || '')}<br><strong>Calculator:</strong> ${calculator.heightCm} cm · ${calculator.weightKg} kg · ${escapeHtml(calculator.profile || 'unset')}</p>
    <div class="simulator__grid">
      <button data-sim="loading">Loading</button><button data-sim="scanning">Scanning</button>
      <button data-sim="ready">Ready to place</button><button data-sim="placed">Placed</button>
      <button data-sim="pickup">Long-press pickup</button><button data-sim="toggle-mode">Toggle AR / 3D</button>
      <button data-sim="collapse-sheet">Collapse sheet</button><button data-sim="expand-sheet">Expand sheet</button>
      <button data-sim="model-failed">Model failure</button><button data-sim="lost">Tracking lost</button>
      <button data-sim="recovered">Recovery success</button><button data-sim="recovery-failed">3D fallback</button>
      <button data-sim="calculator-offer">Calculator offer</button><button data-sim="adult">Adult check</button>
      <button data-sim="profile">Profile</button><button data-sim="age">Age band</button>
      <button data-sim="height">Height instrument</button><button data-sim="weight">Weight dial</button>
      <button data-sim="activity">Activity</button><button data-sim="result">Typical result</button>
      <select id="sim-boundary" aria-label="BMI boundary preset"><option value="18.5">BMI 18.5</option><option value="22.9">BMI 22.9</option><option value="23">BMI 23.0</option><option value="27.4">BMI 27.4</option><option value="27.5">BMI 27.5</option></select>
      <button data-sim="boundary">Show boundary</button>
      <button data-sim="under18">Under 18</button><button data-sim="prefer-not">Prefer not to say</button>
      <button data-sim="calculator-failed">Calculator failure</button><button data-sim="reduced-motion">Reduced motion</button>
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
  if (action === 'pickup') window.dispatchEvent(new CustomEvent('robin-pickup-start'))
  if (action === 'toggle-mode') switchRobinMode(document.body.dataset.robinMode === 'ar' ? '3d' : 'ar')
  if (action === 'collapse-sheet') toggleSheet(false)
  if (action === 'expand-sheet') toggleSheet(true)
  if (action === 'lost') setStatus('Tracking lost. Move slowly back toward the surface.', 'warning')
  if (action === 'recovered') { setRobinMode('ar', 'tracking-recovery'); setStatus('Tracking restored') }
  if (action === 'recovery-failed') { setRobinMode('3d', 'tracking-recovery'); setStatus('Continuing in screen-based 3D', 'warning') }
  if (action === 'model-failed') showModelFailure()
  if (action === 'calculator-offer') showCalculatorOffer()
  if (action === 'adult') showAdultCheck()
  if (action === 'profile') showCalculationProfile()
  if (action === 'age') showAgeBand()
  if (action === 'height') showHeightInstrument()
  if (action === 'weight') showWeightDial()
  if (action === 'activity') showActivity()
  if (action === 'result') {
    Object.assign(calculator, {adult: 'yes', profile: 'male', ageBand: '18-29', heightCm: 168, weightKg: 65, activity: 'lvl2'})
    showCalculatorResult()
  }
  if (action === 'boundary') {
    const bmi = Number($('#sim-boundary')?.value || 23)
    Object.assign(calculator, {adult: 'yes', profile: 'female', ageBand: '30-59', heightCm: 200, weightKg: bmi * 4, activity: 'lvl2'})
    showCalculatorResult()
  }
  if (action === 'under18') showUnder18()
  if (action === 'prefer-not') { calculator.profile = 'prefer-not'; showHeightInstrument() }
  if (action === 'calculator-failed') showCalculatorFailure()
  if (action === 'reduced-motion') document.body.classList.toggle('simulate-reduced-motion')
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
  if (target.dataset.action === 'calculator-offer') showCalculatorOffer()
  if (target.dataset.action === 'calculator-start') showAdultCheck()
  if (target.dataset.action === 'calculator-skip') {
    track('Calculator Skipped', {variant})
    showQuestion(0)
  }
  if (target.dataset.action === 'calculator-adult') showAdultCheck()
  if (target.dataset.action === 'calculator-profile') showCalculationProfile()
  if (target.dataset.action === 'calculator-age') showAgeBand()
  if (target.dataset.action === 'calculator-height') {
    if (target.dataset.editResult !== undefined) track('Calculator Result Edited', {variant})
    showHeightInstrument()
  }
  if (target.dataset.action === 'calculator-weight') showWeightDial()
  if (target.dataset.action === 'calculator-activity') showActivity()
  if (target.dataset.action === 'calculator-result') showCalculatorResult()
  if (target.dataset.action === 'questions') showQuestion(0)
  if (target.dataset.action === 'question-back') showQuestion(questionIndex - 1, {push: false})
  if (target.dataset.action === 'screenings') showScreenings({push: false})
  if (target.dataset.action === 'edit') {
    track('Answers Edited', {variant})
    showQuestion(0)
  }
  if (target.dataset.action === 'ask') showAsk()
  if (target.dataset.action === 'close') closeJourney()
  if (target.dataset.action === 'toggle-sheet') toggleSheet()
  if (target.dataset.action === 'mode-menu') { closedState = state; showModeMenu() }
  if (target.dataset.action === 'resume') resumeJourney()
  if (target.dataset.action === 'move-robin') {
    window.dispatchEvent(new CustomEvent('robin-reposition-request'))
    closeJourney()
    setStatus('Tap a new surface to move Robin')
  }
  if (target.dataset.question) {
    answers[target.dataset.question] = target.dataset.value
    showQuestion(Number(target.dataset.next))
  }
  if (target.dataset.screening) showScreening(target.dataset.screening)
  if (target.dataset.screeningPage) showScreening(target.dataset.screeningPage, Number(target.dataset.page))
  if (target.dataset.action === 'screening-back') showScreening(target.dataset.screeningId, screeningPage - 1)
  if (target.dataset.mode) {
    switchRobinMode(target.dataset.mode)
  }
  if (target.dataset.query) answerQuestion(target.dataset.query)
  if (target.dataset.adjust) updateInstrument(target.dataset.adjust, calculator[target.dataset.adjust] + Number(target.dataset.direction))
  if (target.dataset.calc === 'adult') {
    calculator.adult = target.dataset.value
    if (calculator.adult === 'no') showUnder18()
    else showCalculationProfile()
  }
  if (target.dataset.calc === 'profile') {
    calculator.profile = target.dataset.value
    showAgeBand()
  }
  if (target.dataset.calc === 'ageBand') { calculator.ageBand = target.dataset.value; showHeightInstrument() }
  if (target.dataset.calc === 'activity') { calculator.activity = target.dataset.value; showCalculatorResult() }
  if (target.dataset.under18 !== undefined) track('Under 18 Official Route Selected', {variant})
  if (target.dataset.calculatorOfficial !== undefined) track('Official Calculator Selected', {variant})
  if (target.dataset.official) track('Official Action Selected', {variant, screening: target.dataset.official})
})

ui.addEventListener('submit', event => {
  if (event.target.id !== 'question-form') return
  event.preventDefault()
  const query = $('#question-input').value.trim()
  if (query) answerQuestion(query)
})

spatialPrompt?.addEventListener('click', event => {
  if (event.target.closest('[data-prompt="ask"]')) {
    stopIdlePrompts()
    showAsk()
  }
})

window.addEventListener('robin-placed', showPlaced)
window.addEventListener('robin-reality-ready', showReadyToPlace)
window.addEventListener('robin-placement-missed', showPlacementMissed)
window.addEventListener('robin-pickup-start', () => {
  preserveJourney()
  hideJourney()
  setStatus('Robin picked up — move your phone, then tap a surface to place him')
  announce('Robin picked up. Tap a surface to place him.')
  track('Robin Picked Up', {variant})
})
window.addEventListener('robin-open-cards', () => {
  if (['scanning', 'ready-to-place', 'placed'].includes(state)) return
  resumeJourney()
})
window.addEventListener('robin-reset', resetJourney)
window.addEventListener('popstate', event => {
  const target = event.state?.robinState
  if (!target) return
  restoringHistory = true
  const routes = {
    introduction: showIntro,
    'calculator-offer': showCalculatorOffer,
    'calculator-adult': showAdultCheck,
    'calculator-under18': showUnder18,
    'calculator-profile': showCalculationProfile,
    'calculator-age': showAgeBand,
    'calculator-height': showHeightInstrument,
    'calculator-weight': showWeightDial,
    'calculator-activity': showActivity,
    'calculator-result': showCalculatorResult,
    shortlist: showScreenings,
  }
  const questionMatch = target.match(/^question-(\d+)$/)
  if (questionMatch) showQuestion(Number(questionMatch[1]), {push: false})
  else routes[target]?.({push: false})
  restoringHistory = false
})
robinControls?.addEventListener('click', event => {
  const direction = Number(event.target.closest('[data-rotate]')?.dataset.rotate || 0)
  if (!direction) return
  if (document.body.dataset.robinMode === '3d' && fallbackModel) {
    const orbit = fallbackModel.getCameraOrbit?.()
    if (orbit) fallbackModel.cameraOrbit = `${orbit.theta + direction * Math.PI / 8}rad ${orbit.phi}rad ${orbit.radius}m`
  }
  window.dispatchEvent(new CustomEvent('robin-rotate', {detail: {direction}}))
})

arToggle?.addEventListener('click', () => {
  switchRobinMode(document.body.dataset.robinMode === 'ar' ? '3d' : 'ar')
})

window.visualViewport?.addEventListener('resize', updateViewportLayout)
window.visualViewport?.addEventListener('scroll', updateViewportLayout)
window.addEventListener('resize', updateViewportLayout)
new ResizeObserver(updateViewportLayout).observe(ui)

fallbackModel?.addEventListener('load', () => {
  if (state !== 'model-loading') return
  track('Model Loaded', {variant})
  setStatus('')
  setTimeout(() => showIntro({push: false}), simulatorEnabled ? 350 : 3000)
})
fallbackModel?.addEventListener('error', () => showModelFailure())

const showModelFailure = () => {
  state = 'model-failure'
  track('Model Failed', {variant})
  fallback.classList.add('is-static')
  setStatus('Robin’s 3D model could not load. The guide is still available.', 'warning')
  setTimeout(() => showIntro({push: false}), simulatorEnabled ? 350 : 3000)
}

const start3d = (source = 'assigned') => {
  clearTimeout(fallbackOfferTimer)
  arFallbackButton.hidden = true
  state = 'model-loading'
  hideJourney()
  setRobinMode('3d', source)
  setStatus('Loading Robin…')
  if (fallbackModel?.getAttribute('loaded') !== null) setTimeout(() => showIntro({push: false}), simulatorEnabled ? 350 : 3000)
  else setTimeout(() => {
    if (state === 'model-loading') showModelFailure()
  }, simulatorEnabled ? 1500 : 8000)
}

arFallbackButton?.addEventListener('click', () => {
  track('AR Fallback Selected', {variant, outcome: '3d-fallback'})
  try { if (window.XR8 && !XR8.isPaused()) XR8.pause() } catch (_) {}
  start3d('user-selected-fallback')
})

const showLoading = () => {
  state = 'loading'
  hideJourney()
  setStatus(variant === 'ar' ? 'Starting camera…' : 'Preparing Robin…')
  robinControls.hidden = true
  arFallbackButton.hidden = true
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

if (simulatorEnabled && params.get('simstate')) {
  setTimeout(() => {
    const preset = params.get('simstate')
    if (preset === 'offer') showCalculatorOffer()
    if (preset === 'height') {
      Object.assign(calculator, {adult: 'yes', profile: 'male', ageBand: '18-29'})
      showHeightInstrument()
    }
    if (preset === 'weight') {
      Object.assign(calculator, {adult: 'yes', profile: 'male', ageBand: '18-29'})
      showWeightDial()
    }
    if (preset === 'activity') {
      Object.assign(calculator, {adult: 'yes', profile: 'male', ageBand: '18-29'})
      showActivity()
    }
    if (preset === 'result') {
      Object.assign(calculator, {adult: 'yes', profile: 'male', ageBand: '18-29', heightCm: 168, weightKg: 65, activity: 'lvl2'})
      showCalculatorResult()
    }
  }, 500)
}
