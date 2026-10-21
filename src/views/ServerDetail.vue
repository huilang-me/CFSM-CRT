<template>
  <div class="detail">
    <div v-if="loading && !server" class="term dim">
      connecting to {{ id }}<span class="cursor">█</span>
    </div>

    <div v-else-if="error" class="term">
      <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="ssh" />
      <div class="ln err">ssh: {{ error }}</div>
      <div class="ln dim">Back to all servers: <button class="link" @click="goHome">cd ~</button></div>
    </div>

    <template v-else-if="server">
      <div class="info">
        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="ssh" />
          <div class="term dim">
            <div v-if="online" class="ln">Welcome to {{ server.os || nodeHost }}</div>
            <div v-else class="ln err">ssh: connect to host {{ nodeHost }} port 22: Connection timed out</div>
            <div class="ln">{{ online ? loginLine : offlineLine }}</div>
            <div v-if="liveError" class="ln err">{{ liveError }}</div>
            <div v-if="notice" class="ln warn">{{ notice }}</div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="hostnamectl" />
          <div class="term">
            <div class="ln"><span class="mk">{{ label('Static hostname') }}</span>{{ server.name || '-' }}</div>
            <div v-if="location" class="ln"><span class="mk">{{ label('Location') }}</span>{{ location }}</div>
            <div class="ln"><span class="mk">{{ label('Operating System') }}</span>{{ server.os || 'unknown' }}</div>
            <div class="ln"><span class="mk">{{ label('Kernel') }}</span>{{ server.kernel_version ? 'Linux ' + server.kernel_version : 'unknown' }}</div>
            <div class="ln"><span class="mk">{{ label('Architecture') }}</span>{{ server.arch || 'unknown' }}</div>
            <div class="ln"><span class="mk">{{ label('Monitor Agent') }}</span>{{ server.agent_version || 'unknown' }}</div>
            <div v-if="expireText && sysConfig.show_expire !== false" class="ln"><span class="mk">{{ label('Expires') }}</span>{{ expireText }}</div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="lscpu" args="| grep -E 'Model name|^CPU\(s\)'" />
          <div class="term">
            <div class="ln"><span class="mk">CPU(s):</span> {{ server.cpu_cores || '?' }}</div>
            <div class="ln"><span class="mk">Model name:</span> {{ server.cpu_info || 'unknown' }}</div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="uptime" />
          <div class="term num">
            <div class="ln uptime"><span class="up"> {{ clockText }} up {{ uptimeValue }},  {{ server.processes ?? '?' }} tasks,</span><span class="ld">load average: {{ loadText }}</span></div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="free" args="-h" />
          <div class="term num">
            <div class="ln"> {{ ' '.repeat(6) }}{{ pad('total', 14, 1) }}{{ pad('used', 12, 1) }}{{ pad('free', 12, 1) }}</div>
            <div class="ln"><span class="mk">{{ 'Mem:'.padEnd(6) }}</span>{{ pad(mib(server.ram_total), 14, 1) }}{{ pad(mib(server.ram_used), 12, 1) }}{{ pad(mib(Math.max(0, Number(server.ram_total) - Number(server.ram_used))), 12, 1) }}</div>
            <div class="ln"><span class="mk">{{ 'Swap:'.padEnd(6) }}</span>{{ pad(mib(server.swap_total), 14, 1) }}{{ pad(mib(server.swap_used), 12, 1) }}{{ pad(mib(Math.max(0, Number(server.swap_total) - Number(server.swap_used))), 12, 1) }}</div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="df" args="-h /" />
          <div class="term num">
            <div class="ln">{{ pad('Filesystem', 16) }}{{ pad('Size', 6, 1) }}{{ pad('Used', 6, 1) }}{{ pad('Avail', 6, 1) }}{{ pad('Use%', 5, 1) }} Mounted on</div>
            <div class="ln">{{ pad('/dev/root', 16) }}{{ pad(dfSize(server.disk_total), 6, 1) }}{{ pad(dfSize(server.disk_used), 6, 1) }}{{ pad(dfSize(Math.max(0, Number(server.disk_total) - Number(server.disk_used))), 6, 1) }}<span :class="level(diskPercent)">{{ pad(Math.round(diskPercent) + '%', 5, 1) }}</span> /</div>
          </div>
        </div>

        <div class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="ss" args="-s" />
          <div class="term num">
            <div class="ln">{{ pad('Transport', 12) }}Total</div>
            <div class="ln">{{ pad('TCP', 12) }}{{ server.tcp_conn ?? '-' }}</div>
            <div class="ln">{{ pad('UDP', 12) }}{{ server.udp_conn ?? '-' }}</div>
          </div>
        </div>

        <div v-if="sysConfig.show_tf !== false" class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="vnstat" />
          <div class="term num">
            <div class="ln">{{ ' '.repeat(14) }}{{ pad('rx', 12, 1) }}   {{ pad('tx', 12, 1) }}   {{ pad('total', 12, 1) }}</div>
            <div class="ln dim"> {{ ' '.repeat(14) }}{{ '─'.repeat(42) }}</div>
            <div class="ln"><span class="mk">{{ pad('this month', 14, 1) }}</span>  {{ pad(iec(server.net_rx_monthly), 12, 1) }}<span class="dim">  /</span>{{ pad(iec(server.net_tx_monthly), 12, 1) }}<span class="dim">  /</span>{{ pad(iec(trafficUsed(server)), 12, 1) }}</div>
            <div class="ln"><span class="mk">{{ pad('all time', 14, 1) }}</span>  {{ pad(iec(server.net_rx), 12, 1) }}<span class="dim">  /</span>{{ pad(iec(server.net_tx), 12, 1) }}<span class="dim">  /</span>{{ pad(iec((Number(server.net_rx) || 0) + (Number(server.net_tx) || 0)), 12, 1) }}</div>
            <div class="ln"><span class="mk">{{ pad('now', 14, 1) }}</span>  {{ pad(iecRate(server.net_in_speed), 12, 1) }}<span class="dim">  /</span>{{ pad(iecRate(server.net_out_speed), 12, 1) }}</div>
            <div v-if="quota" class="ln"><span class="mk">{{ pad('quota', 14, 1) }}</span>{{ '  ' + iec(quota.used) + ' of ' + iec(quota.limit) + '  ' }}<span :class="level(quota.percent)">{{ quota.percent.toFixed(1) + '%' }}</span><span v-if="quota.reset > 0" class="dim">{{ '  resets day ' + quota.reset }}</span></div>
          </div>
        </div>

        <div v-if="gpus.length" class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="nvidia-smi" />
          <div class="term num">
            <div class="ln">{{ pad('GPU', 5) }}{{ pad('NAME', 28) }}{{ pad('UTIL', 8, 1) }}</div>
            <div v-for="gpu in gpus" :key="gpu.id" class="ln">{{ pad(gpu.id, 5) }}{{ pad(gpu.name || 'unknown', 28) }}{{ pad(gpu.info == null ? '-' : Number(gpu.info).toFixed(1) + '%', 8, 1) }}</div>
          </div>
        </div>

        <div v-if="diskIo" class="blk">
          <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="iostat" args="-x 1 1" />
          <div class="term num">
            <div class="ln">{{ pad('Device', 8) }}{{ pad('r/s', 11, 1) }}{{ pad('w/s', 11, 1) }}{{ pad('r_iops', 8, 1) }}{{ pad('w_iops', 8, 1) }}{{ pad('await', 8, 1) }}{{ pad('util', 7, 1) }}</div>
            <div class="ln">{{ pad('disk', 8) }}{{ pad(iecRate(diskIo.read_bps), 11, 1) }}{{ pad(iecRate(diskIo.write_bps), 11, 1) }}{{ pad(diskIo.read_iops ?? 0, 8, 1) }}{{ pad(diskIo.write_iops ?? 0, 8, 1) }}{{ pad((Number(diskIo.await_ms) || 0).toFixed(1) + 'ms', 8, 1) }}{{ pad((Number(diskIo.util) || 0).toFixed(1) + '%', 7, 1) }}</div>
          </div>
        </div>
      </div>

      <PsLine :user="user" :host="nodeHost" :sigil="sigil" cmd="sar" args="-u -r -n DEV">
        <button
          v-for="r in availableRanges"
          :key="r"
          class="flag"
          :class="{ on: r === range }"
          :aria-pressed="String(r === range)"
          @click="setRange(r)"
        >{{ rangeLabel(r) }}</button>
      </PsLine>

      <div class="charts">
        <MetricChart title="%cpu" :timestamps="chartTs" :series="cpuSeries" :format="twoDecimals" :fixed-max="100" :gap="gapMs" :error="historyError" />
        <MetricChart title="%memused" :timestamps="chartTs" :series="memSeries" :format="twoDecimals" :fixed-max="100" :gap="gapMs" :error="historyError" />
        <MetricChart title="rx/s tx/s" :timestamps="chartTs" :series="netSeries" :format="iecRate" :gap="gapMs" :error="historyError" />
        <MetricChart title="%diskused" :timestamps="chartTs" :series="diskSeries" :format="twoDecimals" :fixed-max="100" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="diskIoSeries.length" title="disk r/s w/s" :timestamps="chartTs" :series="diskIoSeries" :format="iecRate" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="loadSeries.length" title="load average" :timestamps="chartTs" :series="loadSeries" :format="twoDecimals" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="procSeries.length" title="procs" :timestamps="chartTs" :series="procSeries" :format="intFormat" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="connSeries.length" title="conn tcp/udp" :timestamps="chartTs" :series="connSeries" :format="intFormat" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="pingSeries.length" title="ping (ms)" :timestamps="chartTs" :series="pingSeries" :format="msFormat" :gap="gapMs" :error="historyError" />
        <MetricChart v-if="lossSeries.length" title="loss (%)" :timestamps="chartTs" :series="lossSeries" :format="pctFormat" :fixed-max="100" :gap="gapMs" :error="historyError" />
      </div>
    </template>

    <LiveTimeoutModal
      v-if="timeoutOpen"
      :minutes="wsTimeoutMinutes"
      @continue="continueLive"
      @close="timeoutOpen = false"
    />

    <CliPrompt
      ref="cli"
      :prompt="cliPrompt"
      :placeholder="placeholder"
      :complete="complete"
      @run="run"
      @escape="onEscape"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CliPrompt from '../components/CliPrompt.vue'
import PsLine from '../components/PsLine.vue'
import MetricChart from '../components/MetricChart.vue'
import LiveTimeoutModal from '../components/LiveTimeoutModal.vue'
import { state, findServer, ensureConfig, setCurrent } from '../store'
import { getApiBases } from '../utils/config'
import { fetchHistory, fetchServerDetail } from '../utils/api'
import { createLiveSocket } from '../utils/live'
import { DEFAULT_RANGE, PING_FIELDS, PUBLIC_RANGES, RANGES, REPORT_FIELDS, STORAGE } from '../utils/constants'
import {
  clockShort, col, dfSize, hasDiskIo, iec, iecRate, isOnline, level, mib, normalizeTs,
  offlineFor, parseGpuInfo, parseLoad, pctOf, probeValue, slug, trafficLimitBytes,
  trafficPercent, trafficUsed, uptimeSeconds, uptimeText, dur, fullStamp
} from '../utils/format'

const route = useRoute()
const router = useRouter()
const cli = ref(null)

const id = computed(() => String(route.params.id || ''))
const baseUrl = computed(() => String(route.query.b || getApiBases()[0]))

const server = ref(null)
const loading = ref(true)
watchEffect(() => { state.pageLoading = loading.value && !server.value })
const error = ref('')
const historyError = ref('')
const liveError = ref('')
const notice = ref('')
const timeoutOpen = ref(false)
let paused = false
const range = ref(DEFAULT_RANGE)

let socket = null
let pendingFields = {}
let pendingSamples = []
let pendingReportTs = 0
let flushTimer = null

const authed = computed(() => state.config?.authorization === true)
const availableRanges = computed(() => (authed.value ? RANGES : PUBLIC_RANGES))
const wsTimeoutMinutes = computed(() => state.config?.frontend_ws_timeout_minutes || 0)

const user = computed(() => (authed.value ? 'root' : (slug(state.options.username) || 'guest')))
const sigil = computed(() => (authed.value ? '#' : '$'))
const nodeHost = computed(() => slug(server.value?.name) || id.value)
const online = computed(() => (server.value ? isOnline(server.value, state.tick) : false))
const clockText = computed(() => clockShort(new Date(state.tick)))

const loginLine = computed(() => {
  try {
    const prev = Number(localStorage.getItem(STORAGE.LAST_LOGIN)) || 0
    return prev ? 'Last login: ' + fullStamp(prev) + ' from web' : ''
  } catch (_) { return '' }
})

const offlineLine = computed(() => {
  const ago = server.value ? offlineFor(server.value, state.tick) : null
  return ago == null ? '# this host has never reported' : '# last report ' + dur(ago) + ' ago; showing what the hub remembers'
})

const location = computed(() => [server.value?.server_group, server.value?.region].filter(Boolean).join(', '))
const diskPercent = computed(() => (server.value ? pctOf(server.value.disk_used, server.value.disk_total) : 0))
const uptimeValue = computed(() => {
  const sec = uptimeSeconds(server.value?.boot_time, state.tick)
  return sec == null ? 'N/A' : uptimeText(sec)
})
const loadText = computed(() => parseLoad(server.value?.load_avg).map((v) => v.toFixed(2)).join(', '))

const expireText = computed(() => {
  const raw = String(server.value?.expire_date || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const days = Math.ceil((date.getTime() - state.tick) / 86400000)
  return raw.slice(0, 10) + (days >= 0 ? ' (' + days + 'd left)' : ' (expired)')
})

const quota = computed(() => {
  const limit = trafficLimitBytes(server.value)
  if (!limit) return null
  return {
    used: trafficUsed(server.value),
    limit,
    percent: trafficPercent(server.value),
    reset: Number(server.value?.reset_day) || 0
  }
})

const gpus = computed(() => parseGpuInfo(server.value?.gpu_info))
const diskIo = computed(() => (server.value && hasDiskIo(server.value) ? server.value.disk : null))
const sysConfig = computed(() => server.value?.__sysConfig || state.sysConfig || {})

const label = (key) => key.padStart(17) + ': '
const pad = (text, width, right) => col(text, width, right)
const twoDecimals = (v) => Number(v).toFixed(2)
const intFormat = (v) => String(Math.round(Number(v)))
const msFormat = (v) => (Number.isInteger(Number(v)) ? String(v) : Number(v).toFixed(1)) + ' ms'
const pctFormat = (v) => (Number.isInteger(Number(v)) ? String(v) : Number(v).toFixed(1)) + '%'

function readRange() {
  let stored = DEFAULT_RANGE
  try { stored = Number(localStorage.getItem(STORAGE.RANGE)) || DEFAULT_RANGE } catch (_) {}
  const allowed = authed.value ? RANGES : PUBLIC_RANGES
  return allowed.includes(stored) ? stored : DEFAULT_RANGE
}

function rangeLabel(hours) {
  if (hours < 1) return hours === 0.167 ? '10m' : '30m'
  if (hours < 24) return hours + 'h'
  return hours / 24 + 'd'
}

function setRange(hours) {
  if (range.value === hours) return
  range.value = hours
  try { localStorage.setItem(STORAGE.RANGE, String(hours)) } catch (_) {}
  loadHistory()
}

/* ---------- data ---------- */

const MAX_POINTS = 500
const history = ref([])
const chartTs = computed(() => history.value.map((row) => normalizeTs(row.timestamp)))

// 长区间按后台的 long_history_points 估算采样间隔，短区间固定 5 分钟断线
const longPoints = computed(() => {
  const points = Number(state.config?.long_history_points)
  return [60, 120, 180, 240].includes(points) ? points : 120
})
const gapMs = computed(() => {
  if (range.value <= 1) return 5 * 60 * 1000
  return Math.max(5 * 60 * 1000, Math.ceil((range.value * 3600 * 1000) / longPoints.value) * 1.9)
})

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const percentOf = (row, usedField, totalField) => {
  const total = num(row[totalField]) ?? num(server.value?.[totalField]) ?? 0
  const used = num(row[usedField])
  return total > 0 && used != null ? (used / total) * 100 : null
}

const cpuSeries = computed(() => [{ name: 'avg', color: 'var(--fg)', values: history.value.map((row) => num(row.cpu)) }])
const memSeries = computed(() => {
  const list = [{ name: 'mem', color: 'var(--fg)', values: history.value.map((row) => percentOf(row, 'ram_used', 'ram_total')) }]
  if (Number(server.value?.swap_total) > 0) {
    list.push({ name: 'swap', color: 'var(--warn)', values: history.value.map((row) => percentOf(row, 'swap_used', 'swap_total')) })
  }
  return list
})
const netSeries = computed(() => [
  { name: 'rx', color: 'var(--fg)', values: history.value.map((row) => num(row.net_in_speed)) },
  { name: 'tx', color: 'var(--accent)', values: history.value.map((row) => num(row.net_out_speed)) }
])
const diskSeries = computed(() => [
  { name: '/', color: 'var(--fg)', values: history.value.map((row) => percentOf(row, 'disk_used', 'disk_total')) }
])

const diskField = (row, field) => {
  const flat = row['disk_' + field]
  if (flat !== undefined) return num(flat)
  let disk = row.disk
  if (typeof disk === 'string') {
    try { disk = JSON.parse(disk) } catch (_) { disk = null }
  }
  return disk && typeof disk === 'object' ? num(disk[field]) : null
}

const loadSeries = computed(() => {
  if (!history.value.some((row) => String(row.load_avg || '').trim())) return []
  const parsed = history.value.map((row) => (String(row.load_avg || '').trim() ? parseLoad(row.load_avg) : [null, null, null]))
  return [
    { name: '1m', color: 'var(--fg)', values: parsed.map((v) => v[0]) },
    { name: '5m', color: 'var(--accent)', values: parsed.map((v) => v[1]) },
    { name: '15m', color: 'var(--key)', values: parsed.map((v) => v[2]) }
  ]
})

const procSeries = computed(() => {
  if (!history.value.some((row) => num(row.processes) != null)) return []
  return [{ name: 'proc', color: 'var(--fg)', values: history.value.map((row) => num(row.processes)) }]
})

const connSeries = computed(() => {
  if (!history.value.some((row) => num(row.tcp_conn) != null || num(row.udp_conn) != null)) return []
  return [
    { name: 'tcp', color: 'var(--fg)', values: history.value.map((row) => num(row.tcp_conn)) },
    { name: 'udp', color: 'var(--accent)', values: history.value.map((row) => num(row.udp_conn)) }
  ]
})

const diskIoSeries = computed(() => {
  const read = history.value.map((row) => diskField(row, 'read_bps'))
  const write = history.value.map((row) => diskField(row, 'write_bps'))
  if (!read.some((v) => v != null) && !write.some((v) => v != null)) return []
  return [
    { name: 'r/s', color: 'var(--fg)', values: read },
    { name: 'w/s', color: 'var(--accent)', values: write }
  ]
})

const PING_COLORS = ['var(--fg)', 'var(--accent)', 'var(--key)', 'var(--warn)', 'var(--dim)', 'var(--err)', 'var(--accent)', 'var(--key)']

const seriesFor = (pingKey) => {
  const list = []
  PING_FIELDS.forEach((field, index) => {
    const source = pingKey === 'ping' ? field.ping : field.loss
    const configured = history.value.some((row) => row[source] !== undefined && row[source] !== false && row[source] !== 'false')
    if (!configured) return
    const label = state.config?.[field.nameKey] || field.label
    list.push({
      name: label,
      color: PING_COLORS[index % PING_COLORS.length],
      values: history.value.map((row) => {
        const raw = row[source]
        if (raw === undefined || raw === false || raw === 'false') return null
        const value = probeValue(raw)
        return typeof value === 'number' ? value : null
      })
    })
  })
  return list
}

const pingSeries = computed(() => seriesFor('ping'))
const lossSeries = computed(() => seriesFor('loss'))

async function loadDetail() {
  const result = await fetchServerDetail(id.value, baseUrl.value)
  if (result.error) {
    if (result.error.status === 404) error.value = 'Could not resolve hostname ' + id.value + ': Name or service not known'
    else if (result.error.status === 401) error.value = 'permission denied: sign in to view this server'
    else error.value = result.error.error || 'connection failed'
    loading.value = false
    return
  }
  const local = findServer(id.value, baseUrl.value) || {}
  server.value = { ...local, ...result.data, baseUrl: baseUrl.value }
  setCurrent(server.value)
  loading.value = false
  error.value = ''
}

async function loadHistory() {
  const result = await fetchHistory(id.value, range.value, baseUrl.value)
  if (result.error) {
    if (result.error.status === 403) state.needsTurnstile = true
    historyError.value = result.error.status === 401 ? 'sign in to read this range' : (result.error.error || 'history unavailable')
    history.value = []
    return
  }
  historyError.value = ''
  history.value = result.data
    .map((row) => ({ ...row }))
    .sort((a, b) => normalizeTs(a.timestamp) - normalizeTs(b.timestamp))
}

function lastPointTs() {
  for (let i = history.value.length - 1; i >= 0; i--) {
    const ts = normalizeTs(history.value[i].timestamp)
    if (ts) return ts
  }
  return 0
}

// 实时点用采样自带的 ts，不用本地时间；乱序或重复的样本直接丢弃
function appendSample(ts, data) {
  if (!ts || ts <= lastPointTs()) return
  history.value.push({ ...data, timestamp: ts })
  const cutoff = Date.now() - range.value * 3600 * 1000
  while (history.value.length > MAX_POINTS) history.value.shift()
  while (history.value.length > 2 && normalizeTs(history.value[0].timestamp) < cutoff) history.value.shift()
}

/* ---------- live ---------- */

function flushPending() {
  flushTimer = null
  if (!server.value) { pendingFields = {}; pendingSamples = []; pendingReportTs = 0; return }
  for (const field of Object.keys(pendingFields)) server.value[field] = pendingFields[field]
  pendingFields = {}
  const list = pendingSamples.sort((a, b) => a.ts - b.ts)
  pendingSamples = []
  let newest = 0
  for (const sample of list) {
    appendSample(sample.ts, sample.data)
    newest = Math.max(newest, sample.ts)
  }
  if (newest) server.value.last_updated = newest
  if (pendingReportTs) server.value.report_timestamp = pendingReportTs
  pendingReportTs = 0
}

function ingest(updates) {
  for (const update of updates) {
    for (const sample of Array.isArray(update.samples) ? update.samples : []) {
      const data = sample?.data || sample?.payload || sample?.metrics
      if (!data || typeof data !== 'object') continue
      const ts = normalizeTs(
        data.last_updated ?? data.sample_timestamp ?? sample.ts ?? sample.timestamp ?? data.timestamp ?? update.ts
      )
      if (!ts) continue
      pendingSamples.push({ ts, data })
      if (REPORT_FIELDS.some((field) => data[field] !== undefined) && ts > pendingReportTs) pendingReportTs = ts
      for (const field of Object.keys(data)) {
        const value = data[field]
        if (value === undefined) continue
        if (value === null && !field.startsWith('ping_') && !field.startsWith('loss_')) continue
        pendingFields[field] = value
      }
    }
  }
  if (!flushTimer) flushTimer = setTimeout(flushPending, 1000)
}

function connect() {
  closeSocket()
  socket = createLiveSocket({
    baseUrl: baseUrl.value,
    subscribe: id.value,
    ids: [],
    timeoutMinutes: wsTimeoutMinutes.value,
    onBatch: ingest,
    onStatus: (status) => {
      if (status.connected) liveError.value = ''
      else if (status.failed) liveError.value = 'live stream unavailable, showing the last known data'
      else if (status.reconnecting) liveError.value = 'live stream reconnecting…'
    },
    onTimeout: () => {
      timeoutOpen.value = true
      paused = true
      closeSocket()
    }
  })
}

function closeSocket() {
  if (socket) { socket.close(); socket = null }
  clearTimeout(flushTimer)
  flushTimer = null
  pendingFields = {}
  pendingSamples = []
  pendingReportTs = 0
}

function continueLive() {
  timeoutOpen.value = false
  paused = false
  connect()
}

/* ---------- cli ---------- */

const cliPrompt = computed(() => user.value + '@' + nodeHost.value + ':~' + sigil.value)
const placeholder = "run 'exit' to go back, or 'help'"

function goHome() {
  router.push('/')
}

function print(lines) {
  notice.value = lines
}

const COMMANDS = {
  help: () => print("ssh <server>   open another server\nexit           back to all servers\nclear          clear this message\ntop | htop     switch the home view"),
  exit: () => goHome(),
  logout: () => goHome(),
  clear: () => { notice.value = '' },
  whoami: () => print(user.value),
  hostname: () => print(nodeHost.value),
  ssh: (args) => {
    const query = args.join(' ').toLowerCase()
    const hit = state.servers.find((s) => String(s.name || '').toLowerCase().startsWith(query))
    if (hit) router.push({ path: '/server/' + encodeURIComponent(hit.id), query: state.servers.some((s) => s.baseUrl !== hit.baseUrl) ? { b: hit.baseUrl } : {} })
    else print('ssh: Could not resolve hostname ' + (args.join(' ') || "''"))
  },
  top: () => { router.push('/') },
  htop: () => { router.push('/') },
  admin: () => { window.location.href = '/admin#/admin' }
}

function run(raw) {
  const value = String(raw || '').trim()
  if (!value) return
  const [name, ...args] = value.split(/\s+/)
  if (COMMANDS[name]) { COMMANDS[name](args); return }
  print('bash: ' + name + ': command not found')
}

function complete(value) {
  const parts = value.split(/\s+/)
  const pool = parts.length <= 1 ? Object.keys(COMMANDS) : state.servers.map((s) => slug(s.name) || s.id)
  const prefix = (parts.length <= 1 ? parts[0] : parts.slice(1).join(' ')).toLowerCase()
  const hits = [...new Set(pool.filter((x) => x.toLowerCase().startsWith(prefix)))]
  if (!hits.length) return null
  const done = hits.length === 1 ? hits[0] + ' ' : hits[0]
  return parts.length <= 1 ? done : parts[0] + ' ' + done
}

function onEscape() {
  notice.value = ''
}

/* ---------- lifecycle ---------- */

let onVisibility = null

async function refreshAll() {
  await Promise.all([loadDetail(), loadHistory()])
  if (!paused) connect()
}

const onRefresh = () => { refreshAll() }

onMounted(async () => {
  if (!state.configReady) await ensureConfig()
  range.value = readRange()
  await refreshAll()
  onVisibility = () => {
    if (document.hidden) closeSocket()
    else refreshAll()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('crt:refresh', onRefresh)
})

watch(id, async () => {
  loading.value = true
  server.value = null
  setCurrent(null)
  history.value = []
  error.value = ''
  await refreshAll()
})

watch(availableRanges, (list) => {
  if (!list.includes(range.value)) {
    range.value = DEFAULT_RANGE
    loadHistory()
  }
})

onBeforeUnmount(() => {
  state.pageLoading = false
  setCurrent(null)
  closeSocket()
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('crt:refresh', onRefresh)
})
</script>
