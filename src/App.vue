<template>
  <div>
    <TmuxBar
      :host="host"
      :groups="groups"
      :group="state.group"
      :view="viewMode"
      :total="state.servers.length"
      :error="state.error"
      :palette="state.palette"
      :allow-switch="options.allow_switch"
      :show-admin="options.show_admin"
      :authed="authed"
      :node-label="nodeLabel"
      :now="state.tick"
      @home="goHome"
      @group="onGroup"
      @view="onView"
      @palette="onPalette"
      @settings="openSettings"
    />

    <Transition name="fade">
      <BootOverlay v-if="booting" />
    </Transition>

    <div class="app">
      <NoticeBar v-if="isHome" :text="options.notice" />
      <router-view />
      <FooterLine :version="state.config?.version || ''" />
    </div>

    <TurnstileGate
      v-if="state.needsTurnstile && state.config"
      :site-key="state.config.turnstile_site_key"
      @verified="onVerified"
      @cancel="onTurnstileCancel"
    />

    <LiveTimeoutModal
      v-if="state.liveTimeout"
      :minutes="state.config?.frontend_ws_timeout_minutes || 0"
      @continue="continueLive"
      @close="state.liveTimeout = false"
    />

    <SettingsPanel
      v-if="settingsOpen"
      :options="options"
      :authed="authed"
      @close="settingsOpen = false"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TmuxBar from './components/TmuxBar.vue'
import NoticeBar from './components/NoticeBar.vue'
import FooterLine from './components/FooterLine.vue'
import BootOverlay from './components/BootOverlay.vue'
import TurnstileGate from './components/TurnstileGate.vue'
import LiveTimeoutModal from './components/LiveTimeoutModal.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import {
  state, boot, startLive, stopLive, refreshServers, ensureConfig, resumeLive, findServer,
  setGroup, setView, setPalette, currentView
} from './store'
import { getJwt } from './utils/http'
import { slug } from './utils/format'

const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)

const options = computed(() => state.options)
const authed = computed(() => state.config?.authorization === true || !!getJwt())
const isHome = computed(() => route.name === 'Dashboard')
// state.loading only tracks the server list, which the detail page never fetches,
// so it must not hold the overlay up when the app opens straight on /server/:id.
const booting = computed(() => !state.needsTurnstile && (
  !state.configReady ||
  (isHome.value && state.loading && !state.servers.length) ||
  state.pageLoading
))
const host = computed(() => slug(options.value.hostname) || slug(state.config?.site_title) || 'status')
const viewMode = computed(() => currentView())

const groups = computed(() => {
  const set = new Set()
  for (const server of state.servers) {
    const group = String(server.server_group || '').trim()
    if (group) set.add(group)
  }
  return [...set]
})

const nodeLabel = computed(() => {
  if (route.name !== 'Server') return ''
  const id = String(route.params.id || '')
  const server = findServer(id, String(route.query.b || '')) || (state.current?.id === id ? state.current : null)
  if (!server) return id
  return String(server.name || slug(server.name) || id).slice(0, 28)
})

watch(groups, (list) => {
  if (state.group !== null && state.group !== '' && !list.includes(state.group)) setGroup(null)
})

function onGroup(key) {
  setGroup(key)
  if (!isHome.value) router.push('/')
}

function onView(next) {
  setView(next)
}

function onPalette(id) {
  setPalette(id)
}

function goHome() {
  setGroup(null)
  if (!isHome.value) router.push('/')
}

function openSettings() {
  if (authed.value) settingsOpen.value = true
}

function onSaved() {
  settingsOpen.value = false
}

function onTurnstileCancel() {
  state.needsTurnstile = false
  state.error = 'verification cancelled; press retry to try again'
}

async function onVerified() {
  state.needsTurnstile = false
  await ensureConfig(true)
  window.dispatchEvent(new CustomEvent('crt:refresh'))
}

function continueLive() {
  resumeLive()
}

let onVisibility = null
let onSettings = null

onMounted(() => {
  boot()
  onVisibility = () => {
    if (!isHome.value) return
    if (document.hidden) {
      stopLive()
    } else if (!state.livePaused) {
      refreshServers().then(() => startLive())
    }
  }
  onSettings = () => openSettings()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('crt:settings', onSettings)
})

onBeforeUnmount(() => {
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
  if (onSettings) window.removeEventListener('crt:settings', onSettings)
  stopLive()
})
</script>
