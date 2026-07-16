export type PulseFailure = 'cancelled' | 'permission-denied' | 'poor-signal' | 'timeout' | 'unavailable'
export type PulseResult = {status: 'estimated'; bpm: number} | {status: 'failed'; reason: PulseFailure}

export const estimatePulse = async (
  video: HTMLVideoElement,
  onProgress: (value: number) => void,
  signal?: AbortSignal
): Promise<PulseResult> => {
  let stream: MediaStream | undefined
  try {
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}, audio: false})
    video.srcObject = stream
    await video.play()
    const canvas = document.createElement('canvas')
    canvas.width = 32; canvas.height = 32
    const ctx = canvas.getContext('2d', {willReadFrequently: true})!
    const samples: {t: number; r: number}[] = []
    const started = performance.now()
    while (performance.now() - started < 15000) {
      if (signal?.aborted) return {status: 'failed', reason: 'cancelled'}
      ctx.drawImage(video, 0, 0, 32, 32)
      const data = ctx.getImageData(0, 0, 32, 32).data
      let red = 0
      for (let i = 0; i < data.length; i += 4) red += data[i]
      samples.push({t: performance.now(), r: red / (data.length / 4)})
      onProgress((performance.now() - started) / 15000)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const mean = samples.reduce((sum, sample) => sum + sample.r, 0) / samples.length
    if (mean < 80) return {status: 'failed', reason: 'poor-signal'}
    let best = {score: -Infinity, bpm: 0}
    for (let bpm = 45; bpm <= 180; bpm++) {
      const w = bpm / 60000 * Math.PI * 2
      let sin = 0; let cos = 0
      samples.forEach(sample => { const v = sample.r - mean; sin += v * Math.sin(w * sample.t); cos += v * Math.cos(w * sample.t) })
      const score = sin * sin + cos * cos
      if (score > best.score) best = {score, bpm}
    }
    return {status: 'estimated', bpm: best.bpm}
  } catch (error) {
    if (signal?.aborted) return {status: 'failed', reason: 'cancelled'}
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      return {status: 'failed', reason: 'permission-denied'}
    }
    if (!navigator.mediaDevices?.getUserMedia) return {status: 'failed', reason: 'unavailable'}
    return {status: 'failed', reason: 'timeout'}
  } finally {
    stream?.getTracks().forEach(track => track.stop())
    video.srcObject = null
  }
}
