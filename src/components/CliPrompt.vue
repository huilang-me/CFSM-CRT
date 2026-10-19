<template>
  <form class="cli" autocomplete="off" @submit.prevent="submit">
    <label class="ps1">{{ prompt }}</label>
    <span class="field">
      <input
        ref="input"
        v-model="value"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        enterkeyhint="go"
        :placeholder="placeholder"
        @input="$emit('filter', value)"
        @keydown="onKey"
      />
    </span>
  </form>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  prompt: { type: String, default: 'guest@status:~$' },
  placeholder: { type: String, default: '' },
  complete: { type: Function, default: null }
})

const emit = defineEmits(['run', 'filter', 'escape'])
const value = ref('')
const input = ref(null)
const past = []
let pastIndex = -1

function submit() {
  const raw = value.value.trim()
  if (!raw) return
  past.unshift(raw)
  if (past.length > 50) past.pop()
  pastIndex = -1
  value.value = ''
  emit('run', raw)
}

function onKey(e) {
  if (e.key === 'Escape') {
    value.value = ''
    emit('escape')
  } else if (e.key === 'ArrowUp' && past.length) {
    e.preventDefault()
    pastIndex = Math.min(past.length - 1, pastIndex + 1)
    value.value = past[pastIndex]
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    pastIndex = Math.max(-1, pastIndex - 1)
    value.value = pastIndex < 0 ? '' : past[pastIndex]
  } else if (e.key === 'Tab') {
    e.preventDefault()
    const next = props.complete?.(value.value)
    if (next) value.value = next
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault()
    emit('escape')
  }
}

defineExpose({
  setValue(v) { value.value = v },
  focus() { input.value?.focus() },
  blur() { input.value?.blur() }
})
</script>
