import { wsBaseOf, sameHost } from './config'
import { getJwt } from './http'
import {
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS
} from './constants'

export function createLiveSocket({
  baseUrl,
  subscribe = 'all',
  ids = [],
  timeoutMinutes = 0,
  onBatch,
  onStatus,
  onTimeout
}) {
  let ws = null
  let closed = false
  let reconnectTimer = null
  let lifetimeTimer = null
  let pingTimer = null
  let delay = RECONNECT_INITIAL_DELAY_MS
  let attempts = 0
  let currentIds = [...ids]

  const clearTimers = () => {
    clearTimeout(reconnectTimer)
    clearTimeout(lifetimeTimer)
    clearInterval(pingTimer)
    reconnectTimer = null
    lifetimeTimer = null
    pingTimer = null
  }

  const buildUrl = () => {
    const url = new URL(wsBaseOf(baseUrl) + '/api/ws')
    url.searchParams.set('subscribe', subscribe)
    if (!sameHost(baseUrl)) {
      const token = getJwt()
      if (token) url.searchParams.set('token', token)
    }
    return url.toString()
  }

  const schedule = () => {
    if (closed) return
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      onStatus?.({ connected: false, failed: true, attempt: attempts })
      return
    }
    const wait = Math.min(delay, RECONNECT_MAX_DELAY_MS)
    attempts += 1
    delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS)
    onStatus?.({ connected: false, reconnecting: true, retryIn: wait, attempt: attempts })
    reconnectTimer = setTimeout(connect, wait)
  }

  const connect = () => {
    if (closed) return
    let socket
    try {
      socket = new WebSocket(buildUrl())
    } catch (_) {
      schedule()
      return
    }
    ws = socket

    socket.onopen = () => {
      if (closed) return
      attempts = 0
      delay = RECONNECT_INITIAL_DELAY_MS
      onStatus?.({ connected: true })
      if (subscribe === 'all' && currentIds.length) {
        socket.send(JSON.stringify({ type: 'subscribe', scope: 'all', ids: currentIds.slice(0, 500) }))
      }
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }, 30000)
      if (timeoutMinutes > 0) {
        lifetimeTimer = setTimeout(() => {
          closed = true
          clearTimers()
          try { socket.close() } catch (_) {}
          onStatus?.({ connected: false })
          onTimeout?.()
        }, timeoutMinutes * 60 * 1000)
      }
    }

    socket.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch (_) { return }
      if (msg && msg.type === 'batchUpdate' && Array.isArray(msg.updates)) {
        onBatch?.(msg.updates)
      }
    }

    socket.onerror = () => {
      try { socket.close() } catch (_) {}
    }

    socket.onclose = () => {
      clearTimers()
      if (closed) return
      onStatus?.({ connected: false })
      schedule()
    }
  }

  const close = () => {
    closed = true
    clearTimers()
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      try { ws.close() } catch (_) {}
      ws = null
    }
  }

  const updateIds = (next) => {
    currentIds = [...next]
    if (subscribe === 'all' && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', scope: 'all', ids: currentIds.slice(0, 500) }))
    }
  }

  connect()

  return { close, updateIds }
}
