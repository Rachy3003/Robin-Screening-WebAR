export type RobinCard = {
  id: string
  topic: string
  question: string
  answer: string
  color: string
  position: [number, number, number]
}

export const ROBIN_CARDS: RobinCard[] = [
  {
    id: 'screening',
    topic: 'Breast Screening',
    question: 'How does a mammogram help with early breast cancer detection?',
    answer: 'A mammogram uses low-dose X-rays to reveal breast changes before they can be felt. Regular screening can find cancer earlier, when treatment is often more successful. Ask your doctor which screening schedule is right for you.',
    color: '#00B67A',
    position: [-1.12, 1.38, 0.12],
  },
  {
    id: 'healthy-singapore',
    topic: 'Healthy Singapore',
    question: 'What are leading causes of poor health in Singapore?',
    answer: 'Heart disease and diabetes are major health concerns. High blood sugar, obesity and high blood pressure are important risk factors. Regular screening and sustainable daily habits can help reduce risk.',
    color: '#F4B400',
    position: [1.12, 1.38, 0.12],
  },
  {
    id: 'conditions',
    topic: 'Managing Conditions',
    question: 'How can I manage diabetes or high blood pressure?',
    answer: 'Work with your doctor on a personal Health Plan. It may include lifestyle changes, recommended screenings, vaccinations and regular check-ins to monitor your progress and adjust your care.',
    color: '#00A7A0',
    position: [-1.18, 0.72, 0.15],
  },
  {
    id: 'wellbeing',
    topic: 'Mental Wellbeing',
    question: 'What mental health issues commonly affect young people?',
    answer: 'Depression, anxiety and self-harm are important health concerns among young people. Awareness, early support and speaking with a trusted adult or healthcare professional can make a meaningful difference.',
    color: '#F28C5A',
    position: [1.18, 0.72, 0.15],
  },
  {
    id: 'sleep',
    topic: 'Better Sleep',
    question: 'What is the circadian rhythm?',
    answer: 'The circadian rhythm is your internal 24-hour body clock. Light and regular routines help it manage sleep and wakefulness. Keeping consistent sleep and wake times can support a healthier rhythm.',
    color: '#7CB342',
    position: [0, 1.92, 0.15],
  },
]

export const HEALTHHUB_LINKS = {
  apple: 'https://apps.apple.com/sg/app/healthhub-sg/id1034200875',
  android: 'https://play.google.com/store/apps/details?id=sg.gov.hpb.healthhub&pli=1',
  fallback: 'https://www.healthhub.sg/',
}
