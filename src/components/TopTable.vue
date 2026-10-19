<template>
  <div class="table term num">
    <div class="tbl">
      <div class="thead">
        <template v-for="(c, i) in cols" :key="c.t">
          <span>{{ i === 0 ? '' : gap(i) }}</span>
          <button
            v-if="c.k"
            :class="{ on: sort === c.k }"
            :title="'Sort by ' + c.t"
            @click="$emit('sort', sort === c.k ? '' : c.k)"
          >{{ cell(c, c.t) }}</button>
          <span v-else>{{ cell(c, c.t) }}</span>
        </template>
      </div>
      <div
        v-for="(server, index) in servers"
        :key="server.baseUrl + '|' + server.id"
        class="trow"
        :class="{ off: !isOnline(server, now) }"
        tabindex="0"
        @click="$emit('open', server)"
        @keydown.enter="$emit('open', server)"
      >
        <template v-for="(c, i) in cols" :key="c.t">
          <span>{{ i === 0 ? '' : gap(i) }}</span>
          <span :class="c.cls ? c.cls(server) : null">{{ cell(c, c.v(server)) }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { PING_FIELDS } from '../utils/constants'
import {
  clamp, col, dur, fit, isOnline, level, mib, offlineFor, pctOf, pingLevel, pingText, probeValue,
  textWidth, trafficPercent
} from '../utils/format'

const props = defineProps({
  servers: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  sort: { type: String, default: '' },
  showPing: { type: Boolean, default: true },
  now: { type: Number, default: Date.now() }
})

defineEmits(['open', 'sort'])

const narrow = ref(typeof window !== 'undefined' ? window.innerWidth < 760 : false)
const onResize = () => { narrow.value = window.innerWidth < 760 }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const rate = (bps) => {
  const units = ['B/s', 'K/s', 'M/s', 'G/s', 'T/s']
  let v = Math.max(0, Number(bps) || 0)
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + units[i]
}

const pingCell = (server) => {
  const raw = server.ping_ct
  if (raw === undefined || raw === false || raw === 'false') return '-'
  const value = probeValue(raw)
  return value === null ? 'to' : String(Math.round(value))
}

const cols = computed(() => {
  const list = props.servers
  const narrowView = narrow.value
  const names = list.map((s) => String(s.name || ''))
  const groups = props.groups
  return [
    { t: '#', w: Math.max(2, String(list.length).length), r: 1, v: (s) => String(list.indexOf(s) + 1), cls: () => 'dim' },
    { t: 'S', w: 1, v: (s) => (isOnline(s, props.now) ? (Number.isFinite(Number(s.cpu)) ? 'R' : 'S') : 'X'),
      cls: (s) => (isOnline(s, props.now) ? (Number.isFinite(Number(s.cpu)) ? 'ok' : 'warn') : 'err') },
    { k: 'name', t: 'NAME', w: clamp(Math.max(...names.map((n) => textWidth(n)), 8), 8, narrowView ? 14 : 20), v: (s) => s.name || '-' },
    groups.length && !narrowView
      ? { t: 'GROUP', w: clamp(Math.max(...groups.map((g) => textWidth(g)), 5), 5, 12), v: (s) => s.server_group || '-', cls: () => 'dim' }
      : null,
    narrowView ? null : { t: 'RG', w: 3, v: (s) => s.region || '--', cls: () => 'dim' },
    { k: 'cpu', t: '%CPU', w: 5, r: 1, v: (s) => (Number.isFinite(Number(s.cpu)) ? Number(s.cpu).toFixed(1) : '-'),
      cls: (s) => (Number.isFinite(Number(s.cpu)) ? level(Number(s.cpu)) : 'dim') },
    { k: 'mem', t: '%MEM', w: 5, r: 1, v: (s) => (Number(s.ram_total) > 0 ? pctOf(s.ram_used, s.ram_total).toFixed(1) : '-'),
      cls: (s) => (Number(s.ram_total) > 0 ? level(pctOf(s.ram_used, s.ram_total)) : 'dim') },
    narrowView ? null : { k: 'disk', t: '%DSK', w: 5, r: 1, v: (s) => (Number(s.disk_total) > 0 ? pctOf(s.disk_used, s.disk_total).toFixed(1) : '-'),
      cls: (s) => (Number(s.disk_total) > 0 ? level(pctOf(s.disk_used, s.disk_total)) : 'dim') },
    narrowView ? null : { k: 'net', t: 'RX/s', w: 10, r: 1, v: (s) => rate(s.net_in_speed) },
    narrowView ? null : { t: 'TX/s', w: 10, r: 1, v: (s) => rate(s.net_out_speed) },
    narrowView ? null : { t: '%QTA', w: 5, r: 1, v: (s) => (Number.parseFloat(s.traffic_limit) > 0 ? trafficPercent(s).toFixed(1) : '-'),
      cls: (s) => (Number.parseFloat(s.traffic_limit) > 0 ? level(trafficPercent(s)) : 'dim') },
    { k: 'seen', t: 'SEEN', w: 8, r: 1, v: (s) => {
      const ago = offlineFor(s, Date.now())
      return ago == null ? '-' : dur(ago)
    } },
    props.showPing && !narrowView ? { k: 'ping', t: 'PING', w: 5, r: 1, v: pingCell, cls: (s) => pingLevel(probeValue(s.ping_ct)) } : null
  ].filter(Boolean)
})

const gap = (i) => (i === 0 ? '' : i <= 2 || narrow.value ? '  ' : '   ')

const cell = (c, text) => (c.r ? col(text, c.w, true) : fit(text, c.w))
</script>
