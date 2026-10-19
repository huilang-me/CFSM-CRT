<template>
  <div class="overlay">
    <div class="box">
      <div class="head"><span>live connection timeout</span></div>
      <div class="dim">
        The realtime connection reached the {{ minutes }}-minute limit set by the operator.
        Live updates are paused; the page still shows the last received data.
      </div>
      <div class="actions">
        <button type="button" @click="$emit('continue')">continue for another {{ minutes }} minutes</button>
        <button type="button" @click="$emit('close')">stay disconnected</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ minutes: { type: Number, default: 0 } })
defineEmits(['continue', 'close'])
</script>
