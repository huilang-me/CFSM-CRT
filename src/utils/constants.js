export const THEME_ID = 'crt'
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
export const RECONNECT_INITIAL_DELAY_MS = 1000
export const RECONNECT_MAX_DELAY_MS = 30000
export const MAX_RECONNECT_ATTEMPTS = 10
export const RENDER_INTERVAL_MS = 1000
export const CLOCK_INTERVAL_MS = 10000

// 高频采样点只带 cpu/内存/网速；带这些字段的样本才是「本次完整上报」
export const REPORT_FIELDS = ['processes', 'ping_ct', 'disk_total', 'gpu_info', 'tcp_conn']

export const STORAGE = {
  JWT: 'jwt_token',
  TURNSTILE_TOKEN: 'turnstile_token',
  TURNSTILE_VERIFIED: 'turnstile_verified',
  PALETTE: 'crt.palette',
  VIEW: 'crt.view',
  SORT: 'crt.sort',
  RANGE: 'crt.range',
  LAST_LOGIN: 'crt.last_login'
}

export const PING = {
  GOOD: 80,
  WARN: 160,
  CRIT: 240
}

export const RANGES = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168]
export const PUBLIC_RANGES = [0.167, 0.5, 1, 6, 12, 24]
export const DEFAULT_RANGE = 0.167

export const PALETTES = [
  { id: 'graphite', name: 'Graphite', sw: '#2a2c30' },
  { id: 'phosphor', name: 'Phosphor', sw: '#6dfc8e' },
  { id: 'amber', name: 'Amber', sw: '#ffb64a' },
  { id: 'nord', name: 'Nord', sw: '#88c0d0' },
  { id: 'dusk', name: 'Dusk', sw: '#c3a6ff' },
  { id: 'paper', name: 'Paper', sw: '#f6f5f1' }
]

export const PING_FIELDS = [
  { key: 'ct', ping: 'ping_ct', loss: 'loss_ct', label: 'CT', nameKey: 'custom_ct_name', fallback: 'CT' },
  { key: 'cu', ping: 'ping_cu', loss: 'loss_cu', label: 'CU', nameKey: 'custom_cu_name', fallback: 'CU' },
  { key: 'cm', ping: 'ping_cm', loss: 'loss_cm', label: 'CM', nameKey: 'custom_cm_name', fallback: 'CM' },
  { key: 'bd', ping: 'ping_bd', loss: 'loss_bd', label: 'BGP', nameKey: 'custom_bd_name', fallback: 'BGP' },
  { key: 'node_1', ping: 'ping_node_1', loss: 'loss_node_1', label: 'N1', nameKey: 'node_1_name', fallback: 'Node 1' },
  { key: 'node_2', ping: 'ping_node_2', loss: 'loss_node_2', label: 'N2', nameKey: 'node_2_name', fallback: 'Node 2' },
  { key: 'node_3', ping: 'ping_node_3', loss: 'loss_node_3', label: 'N3', nameKey: 'node_3_name', fallback: 'Node 3' },
  { key: 'node_4', ping: 'ping_node_4', loss: 'loss_node_4', label: 'N4', nameKey: 'node_4_name', fallback: 'Node 4' }
]
