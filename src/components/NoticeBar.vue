<template>
  <div v-if="text" class="notice">{{ text }}</div>
</template>

<script setup>
defineProps({ text: { type: String, default: '' } })
</script>
