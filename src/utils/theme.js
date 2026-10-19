import { PALETTES, STORAGE } from './constants'

export const THEME_DEFAULTS = {
  palette: 'graphite',
  allow_switch: true,
  scanlines: false,
  username: 'guest',
  hostname: '',
  notice: '',
  show_summary: true,
  default_view: 'grid',
  show_ping: true,
  show_admin: true
}

const bool = (value, fallback) => {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  if (typeof value === 'number') return value !== 0
  return fallback
}

const text = (value, fallback) => (typeof value === 'string' ? value : fallback)

const read = (key) => {
  try { return localStorage.getItem(key) } catch (_) { return null }
}

const write = (key, value) => {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch (_) {}
}

export const normalizeThemeOptions = (raw) => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const palette = PALETTES.some((p) => p.id === source.palette) ? source.palette : THEME_DEFAULTS.palette
  return {
    palette,
    allow_switch: bool(source.allow_switch, THEME_DEFAULTS.allow_switch),
    scanlines: bool(source.scanlines, THEME_DEFAULTS.scanlines),
    username: text(source.username, THEME_DEFAULTS.username).replace(/[^A-Za-z0-9._-]/g, '') || THEME_DEFAULTS.username,
    hostname: text(source.hostname, THEME_DEFAULTS.hostname).replace(/[^A-Za-z0-9._-]/g, ''),
    notice: text(source.notice, THEME_DEFAULTS.notice),
    show_summary: bool(source.show_summary, THEME_DEFAULTS.show_summary),
    default_view: source.default_view === 'list' ? 'list' : 'grid',
    show_ping: bool(source.show_ping, THEME_DEFAULTS.show_ping),
    show_admin: bool(source.show_admin, THEME_DEFAULTS.show_admin)
  }
}

export const localPalette = () => read(STORAGE.PALETTE)

export const effectivePalette = (options) => {
  const local = localPalette()
  const id = options.allow_switch && local ? local : options.palette
  return PALETTES.some((p) => p.id === id) ? id : THEME_DEFAULTS.palette
}

export const applyAppearance = (options) => {
  const root = document.documentElement
  root.dataset.palette = effectivePalette(options)
  root.classList.toggle('scan-on', !!options.scanlines)
}

export const setLocalPalette = (id, options) => {
  if (!PALETTES.some((p) => p.id === id)) return
  write(STORAGE.PALETTE, id)
  applyAppearance(options)
}

export const localView = () => read(STORAGE.VIEW)

export const setLocalView = (view) => write(STORAGE.VIEW, view === 'list' ? 'list' : 'grid')
