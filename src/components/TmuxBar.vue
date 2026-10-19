<template>
  <header class="tmux">
    <div class="tin">
      <button class="sess" title="Home" @click="$emit('home')">[{{ host }}]</button>
      <nav class="wins" aria-label="Groups">
        <template v-if="!nodeLabel">
          <button
            v-for="(w, i) in windows"
            :key="String(w.key)"
            class="win"
            :class="{ on: group === w.key }"
            :aria-pressed="String(group === w.key)"
            @click="$emit('group', w.key)"
          >{{ i }}:{{ w.label }}{{ group === w.key ? '*' : '' }}</button>
        </template>
        <template v-else>
          <button class="win" @click="$emit('home')">0:all</button>
          <span class="win on">1:ssh {{ nodeLabel }}*</span>
        </template>
      </nav>

      <span v-if="!nodeLabel" class="views seg">
        <button :aria-pressed="String(view === 'grid')" @click="$emit('view', 'grid')">htop</button>
        <button :aria-pressed="String(view === 'list')" @click="$emit('view', 'list')">top</button>
      </span>

      <span v-if="total" class="stat seg">
        <span class="num up">{{ up }}/{{ total }} up</span>
        <span class="num clk">{{ clockText }}</span>
      </span>

      <span v-if="error" class="err">{{ error }}</span>

      <span class="right seg">
        <span v-if="allowSwitch" class="theme">
          <button
            class="tbtn"
            aria-haspopup="true"
            :aria-expanded="String(menuOpen)"
            @click.stop="toggleMenu"
          >theme:{{ palette }}</button>
          <span v-if="menuOpen" class="menu" role="menu" @click.stop>
            <button
              v-for="p in palettes"
              :key="p.id"
              role="menuitemradio"
              :aria-checked="String(palette === p.id)"
              @click="pick(p.id)"
            ><span class="sw" :style="{ background: p.sw }"></span>{{ (p.id === palette ? ' * ' : '   ') + p.id }}</button>
            <button v-if="authed" role="menuitem" @click="openSettings">   settings…</button>
          </span>
        </span>
        <a v-if="showAdmin || authed" class="adm" href="/admin#/admin">admin</a>
      </span>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { PALETTES } from '../utils/constants'
import { clockShort } from '../utils/format'

const props = defineProps({
  host: { type: String, default: 'status' },
  groups: { type: Array, default: () => [] },
  group: { type: [String, null], default: null },
  view: { type: String, default: 'grid' },
  up: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  error: { type: String, default: '' },
  palette: { type: String, default: 'graphite' },
  allowSwitch: { type: Boolean, default: true },
  showAdmin: { type: Boolean, default: true },
  authed: { type: Boolean, default: false },
  nodeLabel: { type: String, default: '' },
  now: { type: Number, default: Date.now() }
})

const emit = defineEmits(['home', 'group', 'view', 'palette', 'settings'])
const palettes = PALETTES
const menuOpen = ref(false)

const windows = computed(() => [
  { key: null, label: 'all' },
  ...props.groups.map((g) => ({ key: g, label: g })),
  ...(props.groups.length ? [{ key: '', label: 'ungrouped' }] : [])
])

const clockText = computed(() => clockShort(new Date(props.now)))

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function pick(id) {
  menuOpen.value = false
  emit('palette', id)
}

function openSettings() {
  menuOpen.value = false
  emit('settings')
}

const close = () => { menuOpen.value = false }
onMounted(() => window.addEventListener('click', close))
onBeforeUnmount(() => window.removeEventListener('click', close))
</script>
