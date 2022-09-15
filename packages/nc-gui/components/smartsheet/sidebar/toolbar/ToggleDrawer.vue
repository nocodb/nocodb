<script setup lang="ts">
/** Sidebar visible */
const { isOpen, toggle } = useSidebar('nc-right-sidebar', { isOpen: true })

const onClick = () => {
  toggle(!isOpen.value)
}
</script>

<template>
  <div :class="{ 'nc-active-btn': isOpen }">
    <a-button size="small" class="nc-toggle-right-navbar" @click="onClick">
      <div class="flex items-center gap-1 text-xs" :class="{ 'text-gray-500': !isOpen }">
        <AntDesignMenuUnfoldOutlined v-if="isOpen" />
        <AntDesignMenuFoldOutlined v-else />

        {{ $t('objects.views') }}
      </div>
    </a-button>
  </div>
</template>
