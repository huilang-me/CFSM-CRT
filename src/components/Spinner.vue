<template>
  <span class="spin" aria-hidden="true">{{ frame }}</span>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const FRAMES = ['|', '/', '-', '\\']
const frame = ref(FRAMES[0])
let timer = null

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => {
    frame.value = FRAMES[(FRAMES.indexOf(frame.value) + 1) % FRAMES.length]
  }, 120)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
