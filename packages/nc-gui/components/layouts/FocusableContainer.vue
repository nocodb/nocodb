<script lang="ts" setup>
const emit = defineEmits<Emits>()

interface Emits {
  (event: 'remove'): void
  (event: 'setFocus'): void
}

const nodeRef = ref<HTMLElement | null>(null)
</script>

<template>
  <div ref="nodeRef" class="p-6 h-full" @click.stop="emit('setFocus')">
    <slot />
    <MdiTrashCanCircleOutline class="text-lg mr-2" @click="emit('remove')" />
  </div>
</template>