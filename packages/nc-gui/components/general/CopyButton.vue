<script setup lang="ts">
import { useCopy } from '~/composables/useCopy'

const props = defineProps<{
  content?: string
  timeout?: number
}>()

const { copy } = useCopy()
const copied = ref(false)

const copyContent = async () => {
  await copy(props.content || '')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, props.timeout || 2000)
}
</script>

<template>
  <NcButton size="xsmall" type="text" @click="copyContent">
    <MdiCheck v-if="copied" class="h-3.5" />
    <component :is="iconMap.copy" v-else class="text-gray-800" />
  </NcButton>
</template>
