import { getApiBases } from './config'
import { STORAGE } from './constants'

const TURNSTILE_VERIFIED_KEY = STORAGE.TURNSTILE_VERIFIED

const readStorage = (key) => {
  try { return localStorage.getItem(key) || '' } catch (_) { return '' }
}

export const getJwt = () => readStorage(STORAGE.JWT)

const buildHeaders = (includeAuth, includeTurnstile, options = {}) => {
  const headers = { 'Content-Type': 'application/json' }
  if (includeAuth) {
    const token = getJwt()
    if (token) headers.Authorization = 'Bearer ' + token
  }
  if (includeTurnstile) {
    if (options.includeTurnstileToken !== false) {
      const token = readStorage(STORAGE.TURNSTILE_TOKEN)
      if (token) headers['X-Turnstile-Token'] = token
    }
    const verified = readStorage(TURNSTILE_VERIFIED_KEY)
    if (verified) headers['X-Turnstile-Verified'] = verified
  }
  return headers
}

export const clearAuth = () => {
  try { localStorage.removeItem(STORAGE.JWT) } catch (_) {}
}

export const clearTurnstile = () => {
  try {
    localStorage.removeItem(STORAGE.TURNSTILE_TOKEN)
    localStorage.removeItem(TURNSTILE_VERIFIED_KEY)
  } catch (_) {}
}

export const cacheTurnstileVerified = (value) => {
  if (!value) return
  try {
    localStorage.setItem(TURNSTILE_VERIFIED_KEY, value)
    localStorage.removeItem(STORAGE.TURNSTILE_TOKEN)
  } catch (_) {}
}

export const redirectToAdmin = () => {
  const target = '/admin#/admin'
  if (window.location.pathname.startsWith('/admin')) return
  window.location.assign(target)
}

const parseResponse = async (res) => {
  if (res.status === 204) return { data: null, status: res.status }
  try {
    const data = await res.json()
    if (data && data.turnstile_verified) cacheTurnstileVerified(data.turnstile_verified)
    return { data, status: res.status }
  } catch (_) {
    return { data: null, status: res.status }
  }
}

const request = async (url, options = {}) => {
  const {
    method = 'GET',
    body = null,
    baseUrl = getApiBases()[0],
    includeAuth = true,
    includeTurnstile = true,
    autoRedirect = true,
    timeoutMs = 20000
  } = options

  const controller = timeoutMs ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await fetch(baseUrl + url, {
      method,
      headers: buildHeaders(includeAuth, includeTurnstile, options),
      body: body == null ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal: controller ? controller.signal : undefined
    })

    if (res.status === 401) {
      clearAuth()
      if (autoRedirect) redirectToAdmin()
      return { error: 'Unauthorized', status: 401, baseUrl }
    }
    if (res.status === 403) {
      clearTurnstile()
      return { error: 'Forbidden', status: 403, baseUrl }
    }
    if (!res.ok) {
      let message = 'Request failed'
      let payload = null
      try {
        payload = await res.json()
        if (payload?.error) message = payload.error
        else if (payload?.message) message = payload.message
        else if (payload?.code) message = String(payload.code)
      } catch (_) {}
      return { error: message, status: res.status, payload, baseUrl }
    }

    const parsed = await parseResponse(res)
    return { ...parsed, baseUrl }
  } catch (e) {
    return { error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'Network error'), status: 0, baseUrl }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const http = {
  get: (url, options) => request(url, options),
  post: (url, body, options) => request(url, { ...(options || {}), method: 'POST', body }),
  async getAll(url, options = {}) {
    const bases = getApiBases()
    const settled = await Promise.allSettled(bases.map((baseUrl) => request(url, { ...options, baseUrl })))
    return settled.map((item, i) => item.status === 'fulfilled'
      ? item.value
      : { error: item.reason?.message || 'Request failed', status: 0, baseUrl: bases[i] })
  }
}
