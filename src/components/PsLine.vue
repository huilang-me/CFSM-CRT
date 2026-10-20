<template>
  <div class="ps">
    <span class="u">{{ user }}@{{ host }}</span><span class="sym">:</span><span class="path">{{ path }}</span><span class="sym">{{ sigil + ' ' }}</span><span class="cmd">{{ cmd }}</span><span v-if="args" class="arg">{{ ' ' + args }}</span><slot />
  </div>
</template>

<script setup>
defineProps({
  user: { type: String, default: 'guest' },
  host: { type: String, default: 'status' },
  path: { type: String, default: '~' },
  sigil: { type: String, default: '$' },
  cmd: { type: String, default: '' },
  args: { type: String, default: '' }
})
</script>
