type Props = Record<string, string | number | boolean>
const allowed = new Set(['variant', 'capability', 'outcome', 'screening', 'duration_bucket'])

export const track = (name: string, props: Props = {}) => {
  const safe = Object.fromEntries(Object.entries(props).filter(([key]) => allowed.has(key)))
  if (window.location.hostname === 'localhost') return console.info('[analytics]', name, safe)
  const plausible = (window as any).plausible
  if (typeof plausible === 'function') plausible(name, {props: safe})
}
