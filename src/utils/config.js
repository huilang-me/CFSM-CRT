let apiBases = []
let configured = false

const strip = (s) => String(s || '').replace(/\/+$/, '')

export const initConfig = () => {
  apiBases = [strip(window.location.origin)]
  configured = false
  const meta = document.querySelector('meta[name="apiBase"]')?.content
  if (meta) {
    const bases = meta.split(',').map((s) => strip(s.trim())).filter(Boolean)
    if (bases.length) {
      apiBases = bases
      configured = true
    }
  }
  window.__APP_API_BASES__ = apiBases
  return apiBases
}

export const getApiBases = () => (apiBases.length ? apiBases : [strip(window.location.origin)])

export const hasMultipleApiBases = () => getApiBases().length > 1

export const hasConfiguredApiBase = () => configured

export const wsBaseOf = (base) => {
  try {
    const u = new URL(base)
    return (u.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + u.host
  } catch (_) {
    return (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host
  }
}

export const sameHost = (base) => {
  try {
    return new URL(base).host === window.location.host
  } catch (_) {
    return true
  }
}
