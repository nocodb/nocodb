<script setup lang="ts">
import { ReadonlyInj } from '~/context'
import MdiCloseThickIcon from '~icons/mdi/close-thick'

interface Props {
  value?: string | number | boolean
  active?: boolean
  item?: any
}

const { value, active, item } = defineProps<Props>()
const readonly = inject(ReadonlyInj, false)
</script>

<template>
  <v-chip class="chip" :class="{ active }" small text-color="textColor">
    <span class="name">{{ value }}</span>

    <div v-show="active" v-if="!readonly" class="mr-n1 ml-2">
      <MdiCloseThickIcon class="unlink-icon" />
    </div>
  </v-chip>
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
