import {ROBIN_CARDS} from './robin-content'

const onxrloaded = () => {
  XR8.addCameraPipelineModule(LandingPage.pipelineModule())
  LandingPage.configure({
    mediaSrc: './assets/preview.jpg'
  })
}
window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)

const byId = id => document.getElementById(id)
const speech = byId('robin-speech')
const topicCard = byId('topic-card')
const cardBody = byId('topic-card-body')
const cardTopic = byId('card-topic')
const cardQuestion = byId('card-question')
const cardAnswer = byId('card-answer')
const cardAccent = byId('card-accent')
const cardPosition = byId('card-position')
const cardProgress = byId('card-progress')
const previousButton = byId('card-previous')
const nextButton = byId('card-next')

let activeCardIndex = 0
let cardFlipped = false

const showSpeech = () => speech?.classList.add('is-visible')
const hideSpeech = () => speech?.classList.remove('is-visible')

const renderCard = () => {
  const card = ROBIN_CARDS[activeCardIndex]
  cardTopic.textContent = card.topic
  cardQuestion.textContent = card.question
  cardAnswer.textContent = card.answer
  cardAccent.style.background = card.color
  cardPosition.textContent = `${activeCardIndex + 1} of ${ROBIN_CARDS.length}`
  previousButton.disabled = activeCardIndex === 0
  nextButton.disabled = activeCardIndex === ROBIN_CARDS.length - 1
  cardProgress.innerHTML = ROBIN_CARDS.map((item, index) => (
    `<span class="progress-dot${index === activeCardIndex ? ' is-active' : ''}"` +
    ` role="img"${index === activeCardIndex ? ' aria-current="step"' : ''}` +
    ` aria-label="${index === activeCardIndex ? 'Current topic: ' : ''}${item.topic}"></span>`
  )).join('')
}

const setFlipped = flipped => {
  cardFlipped = flipped
  cardBody.classList.toggle('is-flipped', flipped)
  cardBody.setAttribute('aria-pressed', String(flipped))
  cardBody.setAttribute('aria-label', flipped ? 'Show question' : 'Reveal answer')
}

const openCards = () => {
  if (topicCard.classList.contains('is-visible')) return
  hideSpeech()
  renderCard()
  setFlipped(false)
  topicCard.classList.add('is-visible')
  topicCard.setAttribute('aria-hidden', 'false')
}

const closeCards = () => {
  topicCard.classList.remove('is-visible')
  topicCard.setAttribute('aria-hidden', 'true')
  setFlipped(false)
  showSpeech()
}

const navigateCard = direction => {
  const nextIndex = Math.min(Math.max(activeCardIndex + direction, 0), ROBIN_CARDS.length - 1)
  if (nextIndex === activeCardIndex) return
  activeCardIndex = nextIndex
  setFlipped(false)
  renderCard()
}

window.addEventListener('robin-placed', () => {
  document.body.classList.add('is-placed')
  hideSpeech()
  topicCard.classList.remove('is-visible')
})

window.addEventListener('robin-prompt-ready', showSpeech)
window.addEventListener('robin-open-cards', openCards)

window.addEventListener('robin-reset', () => {
  document.body.classList.remove('is-placed')
  activeCardIndex = 0
  setFlipped(false)
  hideSpeech()
  topicCard.classList.remove('is-visible')
  topicCard.setAttribute('aria-hidden', 'true')
})

byId('speech-close')?.addEventListener('click', hideSpeech)
byId('card-close')?.addEventListener('click', closeCards)
cardBody?.addEventListener('click', () => setFlipped(!cardFlipped))
previousButton?.addEventListener('click', () => navigateCard(-1))
nextButton?.addEventListener('click', () => navigateCard(1))
