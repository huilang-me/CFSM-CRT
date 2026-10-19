<template>
  <footer class="foot">
    <span>
      Powered by
      <a :title="version ? version : ''" href="https://github.com/huilang-me/CF-Server-Monitor/" target="_blank" rel="noopener noreferrer">CF-Server-Monitor</a>
    </span>
    <span>Theme: <a href="https://github.com/huilang-me/CFSM-CRT" target="_blank" rel="noopener noreferrer">CRT</a></span>
  </footer>
</template>

<script setup>
defineProps({ version: { type: String, default: '' } })
</script>
