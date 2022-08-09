<script setup lang="ts">
import { ActiveCellInj, ReadonlyInj } from '~/context'
import MdiCloseThickIcon from '~icons/mdi/close-thick'

interface Props {
  value?: string | number | boolean
}

const { value } = defineProps<Props>()
const emit = defineEmits(['unlink'])
const readonly = inject(ReadonlyInj, false)
const active = inject(ActiveCellInj, ref(false))
</script>

<template>
  <div class="group py-1 px-2 flex align-center gap-1 bg-gray-200/50 hover:bg-gray-200 rounded-[20px]" :class="{ active }">
    <span class="name">{{ value }}</span>
    <div v-show="active" v-if="!readonly" class="flex align-center">
      <MdiCloseThickIcon class="unlink-icon text-xs text-gray-500/50 group-hover:text-gray-500" @click="emit('unlink')" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.chip {
  max-width: max(100%, 60px);

  .name {
    text-overflow: ellipsis;
    overflow: hidden;
  }
}
</style>
