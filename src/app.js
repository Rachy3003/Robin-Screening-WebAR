import {CAMPAIGN, ageFloor} from './campaign'
import {estimatePulse} from './pulse'
import {track} from './analytics'

const $ = selector => document.querySelector(selector)
const ui = $('#journey')
const fallback = $('#robin-3d')
const pulseVideo = $('#pulse-video')
const answers = {}
let state = 'intro'
let pulseBpm = null
let pulseAbort = null
let pulseCancelled = false

const validateCampaign = campaign => {
  if (!campaign.id || !campaign.version || !campaign.verified || !campaign.officialUrl) throw new Error('Campaign metadata is incomplete')
  if (!Array.isArray(campaign.questions) || campaign.questions.length !== 3) throw new Error('Campaign questions are invalid')
  if (!Array.isArray(campaign.screenings) || !campaign.screenings.length) throw new Error('Campaign screenings are invalid')
  campaign.screenings.forEach(item => {
    ;['id', 'title', 'why', 'check', 'expect', 'support'].forEach(key => {
      if (!item[key]) throw new Error(`Screening ${item.id || 'unknown'} is missing ${key}`)
    })
  })
}
validateCampaign(CAMPAIGN)

const requestedVariant = new URLSearchParams(window.location.search).get('variant')
const variant = (requestedVariant === 'ar' || requestedVariant === '3d')
  ? requestedVariant
  : sessionStorage.getItem('robin-variant') ||
    (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'ar' : '3d')
sessionStorage.setItem('robin-variant', variant)
document.body.dataset.variant = variant
track('Session Start', {variant})

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]
))

const render = html => {
  ui.innerHTML = html
  ui.focus({preventScroll: true})
}

const setRobinMode = mode => {
  document.body.dataset.robinMode = mode
  fallback.hidden = mode !== '3d'
  track('Robin Visible', {variant, capability: mode})
}

const pauseAr = async () => {
  try {
    if (window.XR8 && !XR8.isPaused()) XR8.pause()
  } catch (_) {}
  await new Promise(resolve => setTimeout(resolve, 450))
}

const resumeAr = async () => {
  if (variant === '3d') return setRobinMode('3d')
  try {
    if (window.XR8 && XR8.isPaused()) XR8.resume()
    await Promise.race([
      new Promise(resolve => window.addEventListener('robin-placed', resolve, {once: true})),
      new Promise((resolve, reject) => setTimeout(() => {
        try {
          if (window.XR8 && !XR8.isPaused()) resolve()
          else reject(new Error('AR still paused'))
        } catch (error) {
          reject(error)
        }
      }, 1500)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AR recovery timeout')), 5000)),
    ])
    setRobinMode('ar')
  } catch (_) {
    setRobinMode('3d')
  }
}

const showIntro = () => {
  state = 'intro'
  render(`
    <p class="eyebrow">Meet Robin</p>
    <h1>Let’s look at the bigger picture</h1>
    <p>I can help you explore which general health screenings may be relevant. I won’t diagnose you or confirm eligibility.</p>
    <button class="primary" data-action="pulse-offer">Continue</button>
  `)
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

const startPulse = async () => {
  state = 'pulse'
  pulseCancelled = false
  pulseAbort = new AbortController()
  render(`
    <p class="eyebrow">Experimental estimate</p>
    <h1>Cover the rear camera gently</h1>
    <p>Keep your fingertip still. If your phone becomes warm or uncomfortable, stop.</p>
    <progress id="pulse-progress" max="1" value="0"></progress>
    <p id="pulse-status" aria-live="polite">Preparing camera…</p>
    <button class="secondary" data-action="pulse-cancel">Cancel and continue</button>
  `)
  await pauseAr()
  const result = await estimatePulse(pulseVideo, progress => {
    const meter = $('#pulse-progress')
    if (meter) meter.value = progress
    const status = $('#pulse-status')
    if (status) status.textContent = `Measuring… ${Math.round(progress * 100)}%`
  }, pulseAbort.signal)
  pulseAbort = null
  if (state !== 'pulse') return
  await resumeAr()
  if (pulseCancelled) {
    track('Pulse Failed', {variant, outcome: 'cancelled'})
    return showQuestion(0)
  }
  if (result.status === 'estimated') {
    pulseBpm = result.bpm
    track('Pulse Completed', {variant, outcome: 'estimated'})
    fallback.style.setProperty('--pulse-seconds', `${60 / pulseBpm}s`)
    render(`
      <p class="eyebrow">Your snapshot</p>
      <h1>About ${pulseBpm} beats per minute</h1>
      <p>This experimental estimate reflects one moment. It is not a medical measurement and does not tell us whether you are healthy or unwell.</p>
      <p><strong>One number is a snapshot. Regular screening helps you understand the bigger picture.</strong></p>
      <button class="primary" data-action="questions">Explore screenings</button>
    `)
  } else {
    track('Pulse Failed', {variant, outcome: 'failed'})
    render(`
      <p class="eyebrow">No reliable estimate</p>
      <h1>Let’s continue</h1>
      <p>I couldn’t get a strong enough signal, so I won’t show a number. Your screening guide works without it.</p>
      <button class="primary" data-action="questions">Explore screenings</button>
    `)
  }
}

const showQuestion = index => {
  state = `question-${index}`
  const question = CAMPAIGN.questions[index]
  if (!question) return showScreenings()
  render(`
    <p class="eyebrow">Question ${index + 1} of ${CAMPAIGN.questions.length}</p>
    <h1>${escapeHtml(question.label)}</h1>
    <div class="choices">
      ${question.options.map(option => `<button class="choice" data-question="${question.id}" data-value="${escapeHtml(option)}" data-next="${index + 1}">${escapeHtml(option)}</button>`).join('')}
    </div>
    <p class="privacy">Your answer stays on this device and disappears when the session ends.</p>
  `)
}

const relevantScreenings = () => {
  const age = ageFloor(answers.age || '18–24')
  const eligible = CAMPAIGN.screenings.filter(item => age >= item.minAge)
  const priority = ['pressure', 'cardio', 'colorectal', 'measurements']
  return priority.map(id => eligible.find(item => item.id === id)).filter(Boolean).slice(0, 3)
}

const showScreenings = () => {
  state = 'screenings'
  const items = relevantScreenings()
  track('Questions Completed', {variant})
  render(`
    <p class="eyebrow">Your screening guide</p>
    <h1>These checks may be relevant</h1>
    <p>This is based on your age band and general guidance. HealthHub or a clinic must confirm eligibility.</p>
    <div class="screening-list">
      ${items.map(item => `<button class="screening" data-screening="${item.id}"><strong>${item.title}</strong><span>${item.why}</span></button>`).join('')}
    </div>
    <button class="secondary" data-action="ask">Ask Robin a question</button>
  `)
}

const showScreening = id => {
  state = `screening-${id}`
  const item = CAMPAIGN.screenings.find(entry => entry.id === id)
  if (!item) return showScreenings()
  track('Screening Explored', {variant, screening: id})
  render(`
    <p class="eyebrow">May be relevant</p>
    <h1>${item.title}</h1>
    <h2>Why</h2><p>${item.why}</p>
    <h2>What it checks</h2><p>${item.check}</p>
    <h2>What to expect</h2><p>${item.expect}</p>
    <h2>Cost and support</h2><p>${item.support}</p>
    <p class="source">Guidance version ${CAMPAIGN.version}; verified ${CAMPAIGN.verified}.</p>
    <a class="primary link" href="${CAMPAIGN.officialUrl}" target="_blank" rel="noopener" data-official="${id}">Verify eligibility or arrange screening</a>
    <button class="secondary" data-action="screenings">Back to my list</button>
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
    ${answer ? `<div class="answer" aria-live="polite">${escapeHtml(answer)}</div>` : ''}
    <button class="secondary" data-action="screenings">Back to my list</button>
  `)
}

const answerQuestion = query => {
  const match = intents.find(intent => intent.pattern.test(query))
  track(match ? 'Intent Matched' : 'Intent Unmatched', {variant, outcome: match ? 'matched' : 'unmatched'})
  showAsk(match?.answer || 'I can’t confirm that safely. Try asking about cost, MediSave, preparation, results, or where to go—or verify it through official HealthHub guidance.')
}

ui.addEventListener('click', event => {
  const target = event.target.closest('button, a')
  if (!target) return
  if (target.dataset.action === 'pulse-offer') showPulseOffer()
  if (target.dataset.action === 'pulse-start') startPulse()
  if (target.dataset.action === 'pulse-cancel') {
    pulseCancelled = true
    pulseAbort?.abort()
  }
  if (target.dataset.action === 'questions') { state = 'questions'; showQuestion(0) }
  if (target.dataset.action === 'screenings') showScreenings()
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
  answerQuestion($('#question-input').value.trim())
})

window.addEventListener('robin-prompt-ready', () => {
  if (state === 'intro') showIntro()
})

setRobinMode(variant === '3d' ? '3d' : 'ar')
if (variant === '3d') {
  const releaseArCamera = () => setTimeout(() => {
    try { if (window.XR8 && !XR8.isPaused()) XR8.pause() } catch (_) {}
  }, 500)
  window.XR8 ? releaseArCamera() : window.addEventListener('xrloaded', releaseArCamera, {once: true})
}
showIntro()
