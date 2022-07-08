<script setup lang="ts">
import MdiCloseThickIcon from '~icons/mdi/close-thick'

interface Props {
  modelValue: string | number | boolean
  active: boolean
  item: any
  readonly: boolean
}

const { modelValue, active, item, readonly } = defineProps<Props>()
</script>

<template>
  <v-chip class="chip" :class="{ active }" small text-color="textColor">
    <!--
    :color="isDark ? '' : 'primary lighten-5'"
    @click="!readonly && active && $emit('edit', item)" -->
    <span class="name" :title="modelValue">{{ modelValue }}</span>

    <!--    && _isUIAllowed('xcDatatableEditable') -->
    <div v-show="active" v-if="!readonly" class="mr-n1 ml-2">
      <MdiCloseThickIcon class="unlink-icon">
        <!--        @click.stop="$emit('unlink', item)" -->
      </MdiCloseThickIcon>
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
