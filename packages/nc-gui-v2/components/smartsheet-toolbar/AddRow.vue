<script setup lang="ts">
import MdiAddIcon from '~icons/mdi/plus-outline'

const emits = defineEmits(['addRow'])
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('activity.addRow') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-primary/75 group">
      <MdiAddIcon class="group-hover:(!text-white)" @click="emits('addRow')" />
    </div>
  </a-tooltip>
</template>
