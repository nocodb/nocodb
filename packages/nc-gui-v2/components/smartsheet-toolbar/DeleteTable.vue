<script setup lang="ts">
import MdiDeleteIcon from '~icons/mdi/delete-outline'
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('activity.deleteTable') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-red-500 group">
      <MdiDeleteIcon class="group-hover:(!text-white)" />
    </div>
  </a-tooltip>
</template>
