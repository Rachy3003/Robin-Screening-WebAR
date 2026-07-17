import assert from 'node:assert/strict'
import {calculateBmi, calculateMaintenance, calculateSnapshot, classifyBmi} from '../src/calculator-rules.mjs'

assert.equal(calculateBmi(168, 65), 23)
assert.equal(classifyBmi(18.4).id, 'below-range')
assert.equal(classifyBmi(18.5).id, 'low-risk')
assert.equal(classifyBmi(22.9).id, 'low-risk')
assert.equal(classifyBmi(23).id, 'moderate-risk')
assert.equal(classifyBmi(27.4).id, 'moderate-risk')
assert.equal(classifyBmi(27.5).id, 'high-risk')
assert.equal(classifyBmi(18.49).id, 'below-range')
assert.equal(classifyBmi(22.91).id, 'moderate-risk')
assert.equal(classifyBmi(27.41).id, 'high-risk')
assert.equal(calculateBmi(50, 25), 100)
assert.equal(calculateBmi(250, 250), 40)
assert.throws(() => calculateBmi(49, 65), RangeError)
assert.throws(() => calculateBmi(168, 251), RangeError)
assert.throws(() => calculateBmi(Number.NaN, 65), TypeError)

const profiles = [
  ['male', '18-29', 1890], ['male', '30-59', 1820], ['male', '60+', 1670],
  ['female', '18-29', 1710], ['female', '30-59', 1640], ['female', '60+', 1500],
]
profiles.forEach(([profile, ageBand, expected]) => {
  assert.equal(calculateMaintenance({profile, ageBand, heightCm: 168, weightKg: 65, activity: 'lvl1'}), expected)
})
assert.deepEqual(['lvl1', 'lvl2', 'lvl3', 'lvl4'].map(activity => (
  calculateMaintenance({profile: 'male', ageBand: '18-29', heightCm: 168, weightKg: 65, activity})
)), [1890, 2170, 2440, 2760])

const snapshot = calculateSnapshot({profile: 'male', ageBand: '18-29', heightCm: 168, weightKg: 65, activity: 'lvl2'})
assert.equal(snapshot.bmi, 23)
assert.equal(snapshot.maintenance, 2170)
assert.deepEqual(snapshot.recommended, {low: 1740, high: 1950})

const gain = calculateSnapshot({profile: 'female', ageBand: '30-59', heightCm: 180, weightKg: 50, activity: 'lvl1'})
assert.equal(gain.classification.id, 'below-range')
assert.deepEqual(gain.recommended, {low: 1720, high: 1870})

const bmiOnly = calculateSnapshot({profile: 'prefer-not', heightCm: 168, weightKg: 65})
assert.equal(bmiOnly.maintenance, null)
assert.equal(bmiOnly.recommended, null)

console.log('calculator rules: all tests passed')
