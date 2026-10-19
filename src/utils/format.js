import { ONLINE_THRESHOLD_MS, PING } from './constants'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const p2 = (x) => String(x).padStart(2, '0')

export const clock = (d = new Date()) => p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())

export const clockShort = (d = new Date()) => p2(d.getHours()) + ':' + p2(d.getMinutes())

export const stamp = (ms, rangeMs = 0, full = false) => {
  const d = new Date(ms)
  const hm = clockShort(d)
  return rangeMs >= 86400000 || full ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + hm : hm
}

export const fullStamp = (ms) => {
  const d = new Date(ms)
  return DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2) + ' ' +
    clock(d) + ' ' + d.getFullYear()
}

export const pctOf = (used, total) => (Number(total) > 0 ? (Number(used) / Number(total)) * 100 : 0)

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export const level = (p) => (p >= 90 ? 'err' : p >= 75 ? 'warn' : 'ok')

export const pingLevel = (v) => {
  if (v === null || v === false || v === undefined) return 'dim'
  if (v >= PING.CRIT) return 'err'
  if (v >= PING.WARN) return 'warn'
  if (v >= PING.GOOD) return 'warn'
  return 'ok'
}

export function scale(n, units, base = 1024) {
  let i = 0
  let v = Math.max(0, Number(n) || 0)
  while (v >= base && i < units.length - 1) { v /= base; i++ }
  return [v, units[i]]
}

const fixed = (v, u) => (v < 10 && u !== 'B' && u !== 'K' && u !== 'B/s' ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v))

export function hsize(bytes) {
  const [v, u] = scale(bytes, ['B', 'K', 'M', 'G', 'T', 'P'])
  return (u === 'B' ? Math.round(v) : v < 10 ? v.toFixed(1) : v < 100 ? v.toFixed(1) : Math.round(v)) + u
}

export function iec(bytes) {
  const [v, u] = scale(bytes, ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'])
  return u === 'B' ? Math.round(v) + ' B' : v.toFixed(2) + ' ' + u
}

export function iecRate(bps) {
  const [v, u] = scale(bps, ['B/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s'])
  return u === 'B/s' ? Math.round(v) + ' B/s' : v.toFixed(1) + ' ' + u
}

// RAM / disk values arrive in MiB.
export function mib(mb) {
  const [v, u] = scale(mb, ['M', 'G', 'T', 'P'])
  return (v < 10 && u !== 'M' ? v.toFixed(1) : v < 100 ? v.toFixed(1) : Math.round(v)) + u
}

export function mibParts(mb) {
  const [v, u] = scale(mb, ['M', 'G', 'T', 'P'])
  return [v, u]
}

export function dfSize(mb) {
  const [v, u] = scale(mb, ['M', 'G', 'T', 'P'])
  return (v < 10 && u !== 'M' ? v.toFixed(1) : Math.round(v)) + u
}

export function dur(sec) {
  if (sec == null || !isFinite(sec) || sec < 0) return '?'
  const d = Math.floor(sec / 86400)
  const hh = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return d + 'd ' + hh + 'h'
  if (hh > 0) return hh + 'h ' + m + 'm'
  if (m > 0) return m + 'm'
  return Math.floor(sec) + 's'
}

export function uptimeText(sec) {
  const d = Math.floor(sec / 86400)
  const t = p2(Math.floor((sec % 86400) / 3600)) + ':' + p2(Math.floor((sec % 3600) / 60)) + ':' + p2(Math.floor(sec % 60))
  return d ? d + ' day' + (d === 1 ? '' : 's') + ', ' + t : t
}

export function uptimeShort(sec) {
  const d = Math.floor(sec / 86400)
  const hh = Math.floor((sec % 86400) / 3600)
  const mm = Math.floor((sec % 3600) / 60)
  if (d > 0) return d + 'd ' + p2(hh) + ':' + p2(mm)
  return p2(hh) + ':' + p2(mm)
}

const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u

// 等宽终端里 CJK / emoji 占两格，按显示宽度而不是字符数对齐
export function textWidth(value) {
  let width = 0
  for (const ch of String(value ?? '')) width += WIDE.test(ch) ? 2 : 1
  return width
}

export function fit(str, w) {
  const text = String(str ?? '')
  const width = textWidth(text)
  if (width <= w) return text + ' '.repeat(w - width)
  let out = ''
  let used = 0
  for (const ch of text) {
    const cw = textWidth(ch)
    if (used + cw > w - 1) break
    out += ch
    used += cw
  }
  return out + ' '.repeat(Math.max(0, w - used - 1)) + '+'
}

export function col(text, w, right) {
  const value = String(text ?? '')
  const pad = ' '.repeat(Math.max(0, w - textWidth(value)))
  return right ? pad + value : value + pad
}

export const slug = (str) => String(str || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '')

export function normalizeTs(value) {
  const ts = Number(value)
  if (!Number.isFinite(ts) || ts <= 0) return 0
  return ts < 10000000000 ? ts * 1000 : ts
}

export function isOnline(server, now = Date.now()) {
  const ts = normalizeTs(server?.report_timestamp ?? server?.last_updated)
  return !!ts && now - ts < ONLINE_THRESHOLD_MS
}

export function offlineFor(server, now = Date.now()) {
  const ts = normalizeTs(server?.report_timestamp ?? server?.last_updated)
  return ts ? Math.max(0, Math.floor((now - ts) / 1000)) : null
}

export function uptimeSeconds(bootTime, now = Date.now()) {
  if (!bootTime) return null
  let boot = null
  if (typeof bootTime === 'string' && !/^\d+$/.test(bootTime)) {
    const parsed = new Date(bootTime)
    if (!Number.isNaN(parsed.getTime())) boot = parsed.getTime()
  } else {
    const ts = Number.parseInt(bootTime)
    if (Number.isFinite(ts)) boot = ts < 1000000000000 ? ts * 1000 : ts
  }
  if (!boot || now < boot) return null
  return Math.floor((now - boot) / 1000)
}

export function parseLoad(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0]
}

export function trafficUsed(server) {
  const rx = Number(server?.net_rx_monthly) || 0
  const tx = Number(server?.net_tx_monthly) || 0
  const mode = server?.traffic_calc_type || 'total'
  if (mode === 'dl') return rx
  if (mode === 'ul') return tx
  if (mode === 'max') return Math.max(rx, tx)
  return rx + tx
}

export function trafficLimitBytes(server) {
  const gb = Number.parseFloat(server?.traffic_limit) || 0
  return gb > 0 ? gb * 1024 * 1024 * 1024 : 0
}

export function trafficPercent(server) {
  const limit = trafficLimitBytes(server)
  return limit > 0 ? (trafficUsed(server) / limit) * 100 : 0
}

export function probeValue(value) {
  if (value === false || value === 'false') return false
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const pingText = (value) => {
  const v = probeValue(value)
  if (v === false) return ''
  if (v === null) return 'to'
  return String(Math.round(v))
}

export const lossText = (value) => {
  const v = probeValue(value)
  if (v === false) return ''
  if (v === null) return 'to'
  return (Number.isInteger(v) ? v : v.toFixed(1)) + '%'
}

export function parseGpuInfo(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

export const hasDiskIo = (server) => {
  const disk = server?.disk
  if (!disk || typeof disk !== 'object') return false
  return ['read_bps', 'write_bps', 'read_iops', 'write_iops', 'await_ms', 'util']
    .some((k) => Number(disk[k]) > 0)
}

export const clampPercent = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return clamp(n, 0, 100)
}
