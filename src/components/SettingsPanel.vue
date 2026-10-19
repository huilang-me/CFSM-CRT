<template>
  <div class="overlay">
    <div class="box">
      <div class="head"><span>theme_options</span></div>

      <div class="set-row">
        <span class="k">palette</span>
        <span class="v"><button type="button" @click="cyclePalette">{{ draft.palette }}</button></span>
        <span class="h">default for first-time visitors</span>
      </div>
      <div class="set-row">
        <span class="k">allow_switch</span>
        <span class="v"><button type="button" @click="toggle('allow_switch')">{{ draft.allow_switch ? 'true' : 'false' }}</button></span>
        <span class="h">visitors may pick their own palette</span>
      </div>
      <div class="set-row">
        <span class="k">scanlines</span>
        <span class="v"><button type="button" @click="toggle('scanlines')">{{ draft.scanlines ? 'true' : 'false' }}</button></span>
        <span class="h">faint CRT scanline overlay</span>
      </div>
      <div class="set-row">
        <span class="k">username</span>
        <span class="v"><input v-model="draft.username" class="set-input" maxlength="24" /></span>
      </div>
      <div class="set-row">
        <span class="k">hostname</span>
        <span class="v"><input v-model="draft.hostname" class="set-input" maxlength="32" placeholder="site title" /></span>
      </div>
      <div class="set-row">
        <span class="k">notice</span>
        <span class="v"><textarea v-model="draft.notice" class="set-area" rows="2" maxlength="400"></textarea></span>
      </div>
      <div class="set-row">
        <span class="k">show_summary</span>
        <span class="v"><button type="button" @click="toggle('show_summary')">{{ draft.show_summary ? 'true' : 'false' }}</button></span>
        <span class="h">top summary block on the home page</span>
      </div>
      <div class="set-row">
        <span class="k">default_view</span>
        <span class="v"><button type="button" @click="toggleView">{{ draft.default_view }}</button></span>
        <span class="h">grid = htop panes, list = top table</span>
      </div>
      <div class="set-row">
        <span class="k">show_ping</span>
        <span class="v"><button type="button" @click="toggle('show_ping')">{{ draft.show_ping ? 'true' : 'false' }}</button></span>
        <span class="h">latency column and pane sparkline</span>
      </div>
      <div class="set-row">
        <span class="k">show_admin</span>
        <span class="v"><button type="button" @click="toggle('show_admin')">{{ draft.show_admin ? 'true' : 'false' }}</button></span>
        <span class="h">admin link in the top bar</span>
      </div>

      <div v-if="!authed" class="warn" style="margin-top: 12px">permission denied: sign in at /admin to save theme_options</div>
      <div v-if="status" :class="statusClass" style="margin-top: 12px">{{ status }}</div>

      <div class="actions">
        <button type="button" :disabled="!authed || saving" @click="save">{{ saving ? 'saving…' : 'save' }}</button>
        <button type="button" @click="$emit('close')">cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { PALETTES } from '../utils/constants'
import { normalizeThemeOptions } from '../utils/theme'
import { persistThemeOptions } from '../store'

const props = defineProps({
  options: { type: Object, required: true },
  authed: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'saved'])

const draft = reactive(normalizeThemeOptions(props.options))
const saving = ref(false)
const status = ref('')
const statusClass = computed(() => (status.value.startsWith('saved') ? 'ok' : 'err'))

function toggle(key) {
  draft[key] = !draft[key]
}

function toggleView() {
  draft.default_view = draft.default_view === 'grid' ? 'list' : 'grid'
}

function cyclePalette() {
  const index = PALETTES.findIndex((p) => p.id === draft.palette)
  draft.palette = PALETTES[(index + 1) % PALETTES.length].id
}

async function save() {
  if (!props.authed) return
  saving.value = true
  status.value = ''
  const result = await persistThemeOptions({ ...draft })
  saving.value = false
  if (result.error) {
    status.value = result.error.status === 401 ? 'permission denied: sign in again' : result.error.error
    return
  }
  status.value = 'saved to theme_options'
  emit('saved', normalizeThemeOptions(result.data?.theme_options || draft))
}
</script>
