const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptPromise = null

export const loadTurnstileScript = () => {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { scriptPromise = null; reject(new Error('turnstile script failed')) }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export const renderTurnstile = (container, siteKey, onToken, onError) => {
  if (!window.turnstile || !container) return null
  try {
    return window.turnstile.render(container, {
      sitekey: siteKey,
      theme: 'dark',
      callback: onToken,
      'error-callback': onError
    })
  } catch (e) {
    onError?.(e)
    return null
  }
}
