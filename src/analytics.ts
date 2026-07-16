type Props = Record<string, string | number | boolean>
const allowed = new Set(['variant', 'capability', 'outcome', 'screening', 'duration_bucket'])

export const track = (name: string, props: Props = {}) => {
  const safe = Object.fromEntries(Object.entries(props).filter(([key]) => allowed.has(key)))
  window.dispatchEvent(new CustomEvent('robin-analytics', {detail: {name, props: safe}}))
  if (new URLSearchParams(window.location.search).get('simulator') === '1') {
    return console.info('[simulator analytics]', name, safe)
  }
  if (window.location.hostname === 'localhost') return console.info('[analytics]', name, safe)
  const plausible = (window as any).plausible
  if (typeof plausible === 'function') plausible(name, {props: safe})
}
