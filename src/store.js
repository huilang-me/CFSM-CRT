import { reactive } from 'vue'
import { initConfig, getApiBases } from './utils/config'
import { fetchConfigAll, fetchServersAll, normalizeConfig, saveThemeOptions } from './utils/api'
import {
  applyAppearance, effectivePalette, normalizeThemeOptions, setLocalPalette, setLocalView
} from './utils/theme'
import { createLiveSocket } from './utils/live'
import { redirectToAdmin, getJwt } from './utils/http'
import { CLOCK_INTERVAL_MS, RENDER_INTERVAL_MS, REPORT_FIELDS, STORAGE } from './utils/constants'
import { normalizeTs } from './utils/format'

const emptyStats = () => ({ total: 0, online: 0, offline: 0 })

const readStorage = (key) => {
  try { return localStorage.getItem(key) || '' } catch (_) { return '' }
}

export const state = reactive({
  booted: false,
  configReady: false,
  config: null,
  options: normalizeThemeOptions({}),
  servers: [],
  current: null,
  stats: emptyStats(),
  sysConfig: {},
  regionStats: {},
  loading: true,
  pageLoading: false,
  error: '',
  connected: false,
  reconnecting: false,
  needsTurnstile: false,
  turnstileError: '',
  liveTimeout: false,
  livePaused: false,
  tick: Date.now(),
  serversLoadedAt: 0,
  group: null,
  view: readStorage(STORAGE.VIEW),
  sort: readStorage(STORAGE.SORT),
  query: '',
  palette: 'graphite'
})

let configPromise = null
let serverPromise = null
let sockets = new Map()
let pending = new Map()
let flushTimer = null
let clockTimer = null
let stopping = false

const hasVerified = () => {
  try { return !!localStorage.getItem('turnstile_verified') } catch (_) { return false }
}

export const isAuthed = () => state.config?.authorization === true || !!getJwt()

export async function ensureConfig(force = false) {
  if (configPromise && !force) return configPromise
  configPromise = (async () => {
    const results = await fetchConfigAll()
    const ok = results.find((r) => !r.error && r.data)
    if (!ok) {
      const unauthorized = results.every((r) => r.status === 401)
      if (unauthorized) {
        redirectToAdmin()
        return null
      }
      const failed = results.find((r) => r.error) || {}
      state.error = failed.error === 'timeout' ? 'config request timed out' : (failed.error || 'config unavailable')
      state.configReady = true
      return null
    }

    const config = normalizeConfig(ok.data)
    state.config = config
    const options = normalizeThemeOptions(config.theme_options)
    if (!Object.prototype.hasOwnProperty.call(config.theme_options, 'palette') && config.preferred_theme === 'light') {
      options.palette = 'paper'
    }
    state.options = options
    state.configReady = true
    state.needsTurnstile = config.turnstile_enabled && !!config.turnstile_site_key && !hasVerified()
    applyAppearance(state.options)
    state.palette = effectivePalette(state.options)
    if (config.site_title) document.title = config.site_title

    if (config.is_public === false && !config.authorization && !config.turnstile_enabled) {
      redirectToAdmin()
    }
    return config
  })()

  const result = await configPromise
  if (!result) configPromise = null
  return result
}

export async function refreshServers() {
  if (serverPromise) return serverPromise
  serverPromise = (async () => {
    state.loading = true
    const result = await fetchServersAll()
    state.loading = false
    if (result.error) {
      state.error = result.error.error === 'timeout' ? 'servers request timed out' : (result.error.error || 'servers unavailable')
      if (result.error.status === 403) state.needsTurnstile = true
      return false
    }
    state.error = ''
    state.stats = result.stats
    state.sysConfig = result.sysConfig
    state.regionStats = result.regionStats
    state.servers = result.servers
    state.serversLoadedAt = Date.now()
    return true
  })()
  const ok = await serverPromise
  serverPromise = null
  return ok
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(flushPending, RENDER_INTERVAL_MS)
}

function flushPending() {
  flushTimer = null
  if (!pending.size) return
  const patches = pending
  pending = new Map()
  for (const [key, patch] of patches) {
    const [baseUrl, id] = key.split('|')
    const server = state.servers.find((s) => s.id === id && s.baseUrl === baseUrl)
    if (!server) continue
    for (const field of Object.keys(patch)) {
      const value = patch[field]
      if (value === undefined) continue
      if (value === null && !field.startsWith('ping_') && !field.startsWith('loss_')) continue
      server[field] = value
    }
    // 上报时间以样本自带的为准；只有样本没带时间时才用本地时间兜底
    if (patch.last_updated === undefined && patch.report_timestamp === undefined) {
      server.last_updated = Date.now()
      server.report_timestamp = Date.now()
    }
  }
}

function ingest(baseUrl, updates) {
  for (const update of updates) {
    if (!update || !update.serverId) continue
    const key = baseUrl + '|' + update.serverId
    let patch = pending.get(key)
    if (!patch) { patch = {}; pending.set(key, patch) }
    for (const sample of Array.isArray(update.samples) ? update.samples : []) {
      const data = sample?.data || sample?.payload || sample?.metrics
      if (!data || typeof data !== 'object') continue
      for (const field of Object.keys(data)) {
        if (data[field] !== undefined) patch[field] = data[field]
      }
      if (REPORT_FIELDS.some((field) => data[field] !== undefined)) {
        const ts = normalizeTs(data.last_updated ?? data.sample_timestamp ?? sample.ts ?? sample.timestamp)
        if (ts) patch.report_timestamp = ts
      }
    }
  }
  scheduleFlush()
}

export function startLive() {
  if (state.needsTurnstile || state.livePaused) return
  stopLive()
  stopping = false
  const bases = getApiBases()
  for (const baseUrl of bases) {
    const ids = state.servers.filter((s) => s.baseUrl === baseUrl).map((s) => s.id)
    if (!ids.length) continue
    const socket = createLiveSocket({
      baseUrl,
      subscribe: 'all',
      ids,
      timeoutMinutes: state.config?.frontend_ws_timeout_minutes || 0,
      onBatch: (updates) => ingest(baseUrl, updates),
      onStatus: (status) => {
        if (stopping) return
        if (status.connected) {
          state.connected = true
          state.reconnecting = false
          state.error = ''
        } else if (status.failed) {
          state.connected = false
          state.reconnecting = false
          state.error = 'live stream unavailable, showing the last known data'
        } else {
          state.connected = false
          state.reconnecting = !!status.reconnecting
        }
      },
      onTimeout: () => {
        state.liveTimeout = true
        state.livePaused = true
        stopLive()
      }
    })
    sockets.set(baseUrl, socket)
  }
}

export function stopLive() {
  stopping = true
  for (const socket of sockets.values()) socket.close()
  sockets.clear()
  pending = new Map()
  state.connected = false
  state.reconnecting = false
  clearTimeout(flushTimer)
  flushTimer = null
}

export function resumeLive() {
  state.liveTimeout = false
  state.livePaused = false
  startLive()
}

export function startClock() {
  if (clockTimer) return
  clockTimer = setInterval(() => { state.tick = Date.now() }, CLOCK_INTERVAL_MS)
}

export function updateOptions(next) {
  state.options = normalizeThemeOptions({ ...state.config?.theme_options, ...next })
  applyAppearance(state.options)
  state.palette = effectivePalette(state.options)
}

export function setGroup(key) {
  state.group = key
}

export function setView(view) {
  state.view = view === 'list' ? 'list' : 'grid'
  setLocalView(state.view)
}

export function setSort(key) {
  state.sort = key || ''
  try {
    state.sort ? localStorage.setItem(STORAGE.SORT, state.sort) : localStorage.removeItem(STORAGE.SORT)
  } catch (_) {}
}

export function setQuery(value) {
  state.query = String(value || '')
}

export function setPalette(id) {
  setLocalPalette(id, state.options)
  state.palette = effectivePalette(state.options)
}

export function currentView() {
  return (state.view || state.options.default_view) === 'list' ? 'list' : 'grid'
}

export async function persistThemeOptions(patch) {
  const merged = { ...(state.config?.theme_options || {}), ...patch }
  const result = await saveThemeOptions(merged)
  if (result.error) return result
  state.config.theme_options = merged
  updateOptions(merged)
  return result
}

export async function boot() {
  initConfig()
  const config = await ensureConfig()
  state.booted = true
  startClock()
  if (!config) return false
  return true
}

export function findServer(id, baseUrl = '') {
  return state.servers.find((s) => s.id === id && (!baseUrl || s.baseUrl === baseUrl)) || null
}

// 详情页直开时首页列表还没加载，用它给顶栏提供当前主机名
export function setCurrent(server) {
  state.current = server ? { id: server.id, name: server.name || '', baseUrl: server.baseUrl || '' } : null
}
