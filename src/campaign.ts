export const CAMPAIGN = {
  id: 'sg-general-screening-pilot',
  version: '2026-07-16',
  verified: '2026-07-16',
  questions: [
    {id: 'recent', label: 'Have you had a general health screening recently?', options: ['Yes', 'No', 'I’m not sure']},
  ],
  screenings: [
    {id: 'measurements', minAge: 18, title: 'Body measurements', why: 'Body measurements can help build a broader picture of health.', check: 'Height, weight, BMI and waist circumference.', expect: 'Simple measurements taken while standing.', support: 'General screening packages are usually not MediSave-claimable. Ask the provider about current subsidies.'},
    {id: 'pressure', minAge: 18, title: 'Blood pressure', why: 'High blood pressure may not cause obvious symptoms.', check: 'Pressure in the arteries.', expect: 'A cuff is placed around your upper arm for a short reading.', support: 'Coverage depends on the service and provider. HealthHub or a clinic can confirm current support.'},
    {id: 'cardio', minAge: 40, title: 'Cardiovascular risk screening', why: 'Screening may detect diabetes, high cholesterol or high blood pressure earlier.', check: 'Body measurements, blood pressure, blood sugar and cholesterol.', expect: 'Measurements and a venous blood test; ask whether fasting is needed.', support: 'Eligible Healthier SG participants may receive subsidies. General packages are not automatically MediSave-claimable.'},
    {id: 'colorectal', minAge: 50, title: 'Colorectal screening', why: 'Regular screening may detect signs before symptoms appear.', check: 'A FIT kit checks for small amounts of blood in stool.', expect: 'Collect a kit, complete it privately at home and return it as instructed.', support: 'Subsidies and MediSave rules depend on the test and follow-up. Verify through HealthHub or the provider.'},
  ],
  officialUrl: 'https://www.healthhub.sg/programmes/healthiersg-screening/screening-journey',
}

export const ageFloor = (value: string | number) => Number(value) || 18
