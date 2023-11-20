<script setup lang="ts">
import { useSidebar } from '#imports'

const { isOpen } = useSidebar('nc-right-sidebar')
</script>

<template>
  <div :class="{ 'nc-active-btn': isOpen }">
    <div class="flex items-center gap-1 text-xs text-gray-600 px-2.75 mt-1 !py-1" :class="{ 'text-gray-600': !isOpen }">
      {{ $t('objects.views') }}
    </div>
  </div>
</template>
