<template>
  <section ref="box" class="chart">
    <div class="head">
      <span class="t">{{ title }}</span>
    </div>
    <div class="legend num">
      <button
        v-for="s in activeSeries"
        :key="s.name"
        class="lg"
        :class="{ off: hidden.has(s.name) }"
        :aria-pressed="String(!hidden.has(s.name))"
        :title="'toggle ' + s.name"
        @click="toggle(s.name)"
      >
        <i :style="{ background: s.color }"></i>{{ s.name }}<em v-if="averageOf(s) != null"> {{ format(averageOf(s)) }}</em>
      </button>
    </div>

    <div v-if="error" class="msg err">sar: {{ error }}</div>
    <div v-else-if="timestamps.length < 2" class="msg">sar: no samples in this range</div>
    <template v-else>
      <svg
        ref="svg"
        viewBox="0 0 600 130"
        preserveAspectRatio="none"
        @pointermove="onMove"
        @pointerleave="onLeave"
      >
        <line
          v-for="f in [0, 0.5, 1]"
          :key="f"
          class="grid-line"
          x1="0"
          x2="600"
          :y1="y(max * f)"
          :y2="y(max * f)"
          vector-effect="non-scaling-stroke"
        />
        <g v-for="line in drawn" :key="line.name">
          <polyline
            v-for="(segment, i) in line.segments"
            :key="i"
            :points="segment"
            fill="none"
            :stroke="line.color"
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
          />
          <circle v-for="(dot, i) in line.dots" :key="'d' + i" :cx="dot[0]" :cy="dot[1]" r="1.2" :fill="line.color" />
        </g>
        <line
          :x1="cursorX"
          :x2="cursorX"
          y1="4"
          y2="128"
          stroke="var(--dim)"
          stroke-dasharray="2 3"
          vector-effect="non-scaling-stroke"
          :visibility="cursorVisible ? 'visible' : 'hidden'"
        />
      </svg>
      <div class="axis num">
        <span>{{ stamp(t0, range) }}</span>
        <span>{{ stamp(t0 + range / 2, range) }}</span>
        <span>{{ stamp(t1, range) }}</span>
      </div>
      <div v-if="tip" class="tip num" :style="{ left: tip.left + 'px' }">
        <div class="dim when">{{ tip.time }}</div>
        <div class="rows">
          <template v-for="row in tip.rows" :key="row.name">
            <span class="nm" :style="{ color: row.color }">{{ row.name }}</span>
            <span class="vl">{{ row.value }}</span>
          </template>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { stamp } from '../utils/format'

const props = defineProps({
  title: { type: String, default: '' },
  timestamps: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  format: { type: Function, default: (v) => String(v) },
  fixedMax: { type: Number, default: null },
  error: { type: String, default: '' },
  step: { type: Number, default: 60000 },
  gap: { type: Number, default: 0 }
})

const box = ref(null)
const svg = ref(null)
const tip = ref(null)
const cursorVisible = ref(false)
const cursorX = ref(0)

const W = 600
const H = 130
const T = 4
const B = H - 2

const hidden = ref(new Set())
const activeSeries = computed(() => props.series.filter((s) => Array.isArray(s.values)))
const shownSeries = computed(() => activeSeries.value.filter((s) => !hidden.value.has(s.name)))

function toggle(name) {
  const next = new Set(hidden.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  hidden.value = next
}
const t0 = computed(() => props.timestamps[0] || 0)
const t1 = computed(() => props.timestamps[props.timestamps.length - 1] || 0)
const range = computed(() => Math.max(1, t1.value - t0.value))

const max = computed(() => {
  if (props.fixedMax != null) return props.fixedMax
  const all = shownSeries.value.flatMap((s) => s.values).filter((v) => v != null && isFinite(v))
  return Math.max(1, ...all) * 1.15
})

const averageOf = (s) => {
  const nums = s.values.filter((v) => v != null && isFinite(v))
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null
}

const x = (ms) => ((ms - t0.value) / range.value) * W
const y = (v) => B - (Math.min(v, max.value) / max.value) * (B - T)

const drawn = computed(() => {
  const gapAt = props.gap || props.step * 2.5
  return shownSeries.value.map((s) => {
    const segments = []
    const dots = []
    let current = []
    const flush = () => {
      if (current.length === 1) dots.push(current[0])
      else if (current.length > 1) segments.push(current.join(' '))
      current = []
    }
    s.values.forEach((v, i) => {
      if (v == null || !isFinite(v)) { flush(); return }
      if (i > 0 && props.timestamps[i] - props.timestamps[i - 1] > gapAt) flush()
      const point = [x(props.timestamps[i]).toFixed(1), y(v).toFixed(1)]
      current.push(point[0] + ',' + point[1])
    })
    flush()
    return { name: s.name, color: s.color, segments, dots }
  })
})

function onMove(event) {
  if (!svg.value || props.timestamps.length < 2) return
  const rect = svg.value.getBoundingClientRect()
  const at = t0.value + ((event.clientX - rect.left) / rect.width) * range.value
  let index = 0
  for (let i = 1; i < props.timestamps.length; i++) {
    if (Math.abs(props.timestamps[i] - at) < Math.abs(props.timestamps[index] - at)) index = i
  }
  cursorX.value = x(props.timestamps[index])
  cursorVisible.value = true
  const rows = shownSeries.value.map((s) => {
    const value = s.values[index]
    return {
      name: s.name,
      color: s.color,
      value: value == null || !isFinite(value) ? '-' : props.format(value)
    }
  })
  const left = event.clientX - box.value.getBoundingClientRect().left
  tip.value = {
    time: stamp(props.timestamps[index], range.value, true),
    rows,
    left: Math.max(4, Math.min(left + 14, box.value.clientWidth - 160))
  }
}

function onLeave() {
  cursorVisible.value = false
  tip.value = null
}
</script>
