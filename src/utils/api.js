import { http, clearTurnstile } from './http'
import { getApiBases } from './config'

const isTrue = (value) => value === true || value === 'true'

export const normalizeConfig = (data = {}) => ({
  version: data.version || '',
  last_workers_version: data.last_workers_version || '',
  last_agent_version: data.last_agent_version || '',
  is_public: data.is_public !== false,
  authorization: data.authorization === true,
  turnstile_enabled: isTrue(data.turnstile_enabled),
  turnstile_login_enabled: isTrue(data.turnstile_login_enabled),
  turnstile_site_key: data.turnstile_site_key || '',
  site_title: data.site_title || '',
  preferred_theme: ['dark', 'light', 'auto'].includes(String(data.preferred_theme || '').toLowerCase())
    ? String(data.preferred_theme).toLowerCase() : 'auto',
  default_language: data.default_language || 'auto',
  custom_ct_name: data.custom_ct_name || 'CT',
  custom_cu_name: data.custom_cu_name || 'CU',
  custom_cm_name: data.custom_cm_name || 'CM',
  custom_bd_name: data.custom_bd_name || 'BGP',
  node_1_name: data.node_1_name || 'Node 1',
  node_2_name: data.node_2_name || 'Node 2',
  node_3_name: data.node_3_name || 'Node 3',
  node_4_name: data.node_4_name || 'Node 4',
  theme_options: data.theme_options && typeof data.theme_options === 'object' && !Array.isArray(data.theme_options)
    ? data.theme_options : {},
  verified: data.verified === true,
  frontend_ws_timeout_minutes: Number.isInteger(Number(data.frontend_ws_timeout_minutes))
    ? Math.max(0, Math.min(1440, Number(data.frontend_ws_timeout_minutes))) : 0,
  long_history_points: Number(data.long_history_points) || 120,
  latency_window: data.latency_window || null
})

export const fetchConfigAll = async () => {
  let results = await http.getAll('/api/config', {
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false,
    timeoutMs: 15000
  })

  const needRetry = results.some((r) => r.status === 403 || r.error === 'timeout')
  if (needRetry) {
    clearTurnstile()
    results = await http.getAll('/api/config', {
      includeAuth: true,
      includeTurnstile: false,
      autoRedirect: false,
      timeoutMs: 15000
    })
  }
  return results
}

export const fetchServersAll = async () => {
  const results = await http.getAll('/api/servers', { includeAuth: true, includeTurnstile: true, autoRedirect: false })
  const servers = []
  let stats = { total: 0, online: 0, offline: 0 }
  let sysConfig = {}
  let regionStats = {}
  let error = null
  let okCount = 0

  for (const result of results) {
    if (result.error) {
      if (!error) error = result
      continue
    }
    okCount++
    const data = result.data || {}
    const baseUrl = result.baseUrl
    const siteSysConfig = data.sysConfig && typeof data.sysConfig === 'object' ? data.sysConfig : {}
    if (!Object.keys(sysConfig).length) sysConfig = siteSysConfig
    for (const server of Array.isArray(data.servers) ? data.servers : []) {
      servers.push({ ...server, baseUrl, __sysConfig: siteSysConfig })
    }
    const siteStats = data.stats || {}
    stats.total += Number(siteStats.total) || 0
    stats.online += Number(siteStats.online) || 0
    stats.offline += Number(siteStats.offline) || 0
    for (const [region, count] of Object.entries(data.regionStats || {})) {
      regionStats[region] = (regionStats[region] || 0) + (Number(count) || 0)
    }
  }

  if (okCount === 0) return { error: error || { status: 0, error: 'Network error' }, servers: [], stats, sysConfig, regionStats }
  return { servers, stats, sysConfig, regionStats, error: null }
}

export const fetchServerDetail = async (id, baseUrl) => {
  const result = await http.get('/api/server?id=' + encodeURIComponent(id), {
    baseUrl,
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false
  })
  if (result.error) return { error: result }
  return { data: result.data, baseUrl: result.baseUrl }
}

export const fetchHistory = async (id, hours, baseUrl) => {
  const result = await http.get('/api/history/all?id=' + encodeURIComponent(id) + '&hours=' + hours, {
    baseUrl,
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false,
    timeoutMs: 30000
  })
  if (result.error) return { error: result }
  return { data: Array.isArray(result.data) ? result.data : [], baseUrl: result.baseUrl }
}

export const saveThemeOptions = async (options) => {
  const result = await http.post('/api/theme_options', { theme_options: options }, {
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false
  })
  if (result.error) return { error: result }
  return { data: result.data }
}

export const apiBases = getApiBases
