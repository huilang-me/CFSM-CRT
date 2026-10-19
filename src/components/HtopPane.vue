<template>
  <article
    class="pane"
    :class="{ off: !online }"
    tabindex="0"
    :aria-label="server.name"
    @click="$emit('open', server)"
    @keydown.enter="$emit('open', server)"
  >
    <div class="head">
      <span class="name" :title="server.name">{{ server.name }}</span>
      <span v-if="regionLabel" class="tag">{{ regionLabel }}</span>
      <span class="grow"></span>
      <span v-if="status" class="st">{{ status }}</span>
    </div>

    <div class="body term num">
      <template v-if="hasMetrics">
        <div v-for="m in meters" :key="m.label" class="ln">
          <span class="mk">{{ m.label }}</span><span class="br">[</span><span :class="'bar ' + m.level">{{ '|'.repeat(m.bars) }}</span>{{ ' '.repeat(m.room - m.bars) }}<span class="mv">{{ m.text }}</span><span class="br">]</span>
        </div>
        <div class="rows">
          <div class="row">
            <span><span class="tk">Tasks: </span><span class="b">{{ server.processes ?? '-' }}</span>; <span class="b">{{ server.tcp_conn ?? '-' }}</span> tcp, <span class="b">{{ server.udp_conn ?? '-' }}</span> udp</span>
            <span><span class="tk">Load: </span><span class="b">{{ loadText }}</span></span>
          </div>
          <div class="row">
            <span><span class="tk">Uptime: </span><span class="b">{{ uptime }}</span></span>
            <span><span class="tk">Net: </span><span class="dim">rx </span><span class="b">{{ rate(server.net_in_speed) }}</span><span class="dim">  tx </span><span class="b">{{ rate(server.net_out_speed) }}</span></span>
          </div>
          <div v-if="showPing && latency.length" class="lat">
            <span class="nums">
              <span v-for="item in latency" :key="item.key"><span class="dim">{{ item.label }} </span><span :class="item.cls">{{ item.text }}</span></span>
            </span>
          </div>
        </div>
      </template>
      <template v-else-if="online">
        <div class="ln dim wrap">ssh: connected to {{ host }}, waiting for the first report</div>
        <div class="ln"><span class="cursor">█</span></div>
      </template>
      <template v-else>
        <div class="ln err">ssh: connect to host {{ host }} port 22: Connection timed out</div>
        <div class="ln dim">{{ offlineText }}</div>
      </template>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { PING_FIELDS } from '../utils/constants'
import {
  clamp, dur, hsize, isOnline, level, mib, offlineFor, parseLoad, pctOf,
  pingLevel, pingText, probeValue, slug, trafficLimitBytes, trafficPercent, trafficUsed, uptimeSeconds, uptimeShort
} from '../utils/format'

const props = defineProps({
  server: { type: Object, required: true },
  config: { type: Object, default: () => ({}) },
  showPing: { type: Boolean, default: true },
  now: { type: Number, default: Date.now() }
})

defineEmits(['open'])

const online = computed(() => isOnline(props.server, props.now))
const host = computed(() => slug(props.server.name) || 'node')
const regionLabel = computed(() => props.server.region || props.server.server_group || '')

const status = computed(() => {
  if (!online.value) return null
  return hasMetrics.value ? null : 'waiting'
})

const hasMetrics = computed(() => online.value && Number.isFinite(Number(props.server.cpu)) && props.server.last_updated != null)

const offlineText = computed(() => {
  const ago = offlineFor(props.server, props.now)
  return ago == null ? 'never seen' : 'last seen ' + dur(ago) + ' ago'
})

function rate(bps) {
  const units = ['B/s', 'K/s', 'M/s', 'G/s', 'T/s']
  let v = Math.max(0, Number(bps) || 0)
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + units[i]
}

function meter(label, pct, text, width = 24) {
  const v = clamp(pct || 0, 0, 100)
  const room = Math.max(0, width - text.length)
  const bars = Math.min(room, Math.round((v / 100) * width))
  return { label, level: level(v), bars, room, text }
}

const meters = computed(() => {
  const s = props.server
  const limit = trafficLimitBytes(s)
  const quota = limit > 0
  const list = [
    meter('CPU', Number(s.cpu) || 0, (Number(s.cpu) || 0).toFixed(1) + '%'),
    meter('Mem', pctOf(s.ram_used, s.ram_total), mib(s.ram_used) + '/' + mib(s.ram_total)),
    meter('Dsk', pctOf(s.disk_used, s.disk_total), mib(s.disk_used) + '/' + mib(s.disk_total))
  ]
  if (quota) {
    list.push(meter('Qta', trafficPercent(s), hsize(trafficUsed(s)) + '/' + hsize(limit)))
  } else if (Number(s.swap_total) > 0) {
    list.push(meter('Swp', pctOf(s.swap_used, s.swap_total), mib(s.swap_used) + '/' + mib(s.swap_total)))
  } else {
    list.push(meter('Trf', 0, hsize(trafficUsed(s)) + '/mo'))
  }
  return list
})

const loadText = computed(() => parseLoad(props.server.load_avg).map((v) => v.toFixed(2)).join(' '))

const uptime = computed(() => {
  const sec = uptimeSeconds(props.server.boot_time, props.now)
  return sec == null ? 'N/A' : uptimeShort(sec)
})

const latency = computed(() => {
  const list = []
  for (const field of PING_FIELDS) {
    const raw = props.server[field.ping]
    if (raw === undefined || raw === false || raw === 'false') continue
    const value = probeValue(raw)
    list.push({
      key: field.key,
      label: props.config[field.nameKey] || field.label,
      text: value === null ? 'to' : pingText(raw) + 'ms',
      cls: pingLevel(value)
    })
  }
  return list.slice(0, 4)
})
</script>
