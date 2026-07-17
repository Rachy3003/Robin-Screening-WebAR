export const CALCULATOR_RULES = Object.freeze({
  version: 'healthhub-public-2026-07-17',
  verified: '2026-07-17',
  sourceUrl: 'https://www.healthhub.sg/programmes/nutrition-hub/bmi-calorie-calculator',
  guidanceUrl: 'https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/weight_putting_me_at_risk_of_health_problems',
  under18Url: 'https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition',
  limits: {height: {min: 50, max: 250}, weight: {min: 25, max: 250}},
  activity: {lvl1: 1.2, lvl2: 1.375, lvl3: 1.55, lvl4: 1.75},
})

const round10 = value => Math.round(value / 10) * 10

export const calculateBmi = (heightCm, weightKg) => {
  const height = Number(heightCm)
  const weight = Number(weightKg)
  if (!Number.isFinite(height) || !Number.isFinite(weight)) throw new TypeError('Height and weight must be finite numbers')
  if (height < CALCULATOR_RULES.limits.height.min || height > CALCULATOR_RULES.limits.height.max) throw new RangeError('Height is outside the supported range')
  if (weight < CALCULATOR_RULES.limits.weight.min || weight > CALCULATOR_RULES.limits.weight.max) throw new RangeError('Weight is outside the supported range')
  return Number((weight / ((height / 100) ** 2)).toFixed(1))
}

export const classifyBmi = bmi => {
  if (!Number.isFinite(bmi) || bmi <= 0) throw new TypeError('BMI must be a positive finite number')
  if (bmi < 18.5) return {
    id: 'below-range', label: 'Below 18.5', risk: 'Low risk for obesity-related diseases',
    context: 'You may be at risk of nutritional deficiencies and osteoporosis.', factor: [1.1, 1.2], calorieLabel: 'Weight gain range',
  }
  if (bmi <= 22.9) return {
    id: 'low-risk', label: '18.5 to 22.9', risk: 'Low risk for obesity-related diseases',
    context: '', factor: [1, 1], calorieLabel: 'Weight maintenance',
  }
  if (bmi <= 27.4) return {
    id: 'moderate-risk', label: '23.0 to 27.4', risk: 'Moderate risk for obesity-related diseases',
    context: '', factor: [0.8, 0.9], calorieLabel: 'Weight reduction range',
  }
  return {
    id: 'high-risk', label: '27.5 and above', risk: 'High risk for obesity-related diseases',
    context: 'Consider speaking with a healthcare professional or weight-management specialist for personalised guidance.',
    factor: [0.8, 0.9], calorieLabel: 'Weight reduction range',
  }
}

export const calculateMaintenance = ({profile, ageBand, heightCm, weightKg, activity}) => {
  if (!['male', 'female'].includes(profile)) return null
  const w = Number(weightKg)
  const h = Number(heightCm) / 100
  const equations = {
    male: {
      '18-29': () => 14.4 * w + 313 * h + 113,
      '30-59': () => 11.4 * w + 541 * h - 137,
      '60+': () => 11.4 * w + 541 * h - 256,
    },
    female: {
      '18-29': () => 10.4 * w + 615 * h - 282,
      '30-59': () => 8.18 * w + 502 * h - 11.6,
      '60+': () => 8.52 * w + 421 * h - 10.7,
    },
  }
  const equation = equations[profile][ageBand]
  const multiplier = CALCULATOR_RULES.activity[activity]
  if (!equation || !multiplier) throw new TypeError('Calculation profile is incomplete')
  return round10(equation() * multiplier)
}

export const calculateSnapshot = input => {
  const bmi = calculateBmi(input.heightCm, input.weightKg)
  const classification = classifyBmi(bmi)
  const maintenance = calculateMaintenance(input)
  const recommended = maintenance === null ? null : {
    low: round10(maintenance * classification.factor[0]),
    high: round10(maintenance * classification.factor[1]),
  }
  return {bmi, classification, maintenance, recommended, rulesVersion: CALCULATOR_RULES.version}
}

export const formatCalories = value => new Intl.NumberFormat('en-SG').format(value)
