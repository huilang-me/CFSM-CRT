<template>
  <div class="overlay">
    <div class="box">
      <div class="head"><span>verification required</span></div>
      <div class="dim">This status page is protected by Turnstile. Complete the challenge to continue.</div>
      <div ref="holder" class="gate-widget"></div>
      <div v-if="error" class="err">{{ error }}</div>
      <div class="actions">
        <button type="button" @click="retry">retry</button>
        <button type="button" @click="$emit('cancel')">cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { loadTurnstileScript, renderTurnstile } from '../utils/turnstile'
import { http } from '../utils/http'
import { STORAGE } from '../utils/constants'

const props = defineProps({ siteKey: { type: String, required: true } })
const emit = defineEmits(['verified', 'cancel'])

const holder = ref(null)
const error = ref('')
let widgetId = null

async function verify(token) {
  try {
    localStorage.setItem(STORAGE.TURNSTILE_TOKEN, token)
  } catch (_) {}
  const result = await http.get('/api/config', {
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false,
    timeoutMs: 15000
  })
  if (result.error) {
    error.value = result.status === 403 ? 'verification failed, try again' : result.error
    reset()
    return
  }
  if (result.data?.verified === true) {
    emit('verified')
  } else {
    error.value = 'verification did not complete, try again'
    reset()
  }
}

function reset() {
  try {
    if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId)
  } catch (_) {}
}

function retry() {
  error.value = ''
  reset()
}

onMounted(async () => {
  try {
    await loadTurnstileScript()
    widgetId = renderTurnstile(holder.value, props.siteKey, verify, () => {
      error.value = 'challenge failed to load, retry'
    })
  } catch (_) {
    error.value = 'turnstile script could not be loaded'
  }
})
</script>
