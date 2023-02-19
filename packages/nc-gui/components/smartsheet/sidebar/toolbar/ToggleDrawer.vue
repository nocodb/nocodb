<script setup lang="ts">
import { useSidebar } from '#imports'

const { isOpen, toggle } = useSidebar('nc-right-sidebar')

const onClick = (_event: Event) => {
  // event.stopPropagation()
  // alert('onClick toggle button')
  toggle(!isOpen.value)
}
</script>

<template>
  <div :class="{ 'nc-active-btn': isOpen }">
    FOO<a-button size="small" class="nc-toggle-right-navbar" @click="onClick">
      <div class="flex items-center gap-1 text-[0.6rem] text-gray-500" :class="{ 'text-gray-500': !isOpen }">
        <AntDesignMenuUnfoldOutlined v-if="isOpen" />

        <AntDesignMenuFoldOutlined v-else />

        {{ $t('objects.views') }}
      </div>
    </a-button>BAR
  </div>
</template>
