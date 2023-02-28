<script lang="ts" setup>
import { ref, useNuxtApp, useRoute, useSidebar } from '#imports'

const route = useRoute()

useSidebar('nc-left-sidebar')

const hasSider = ref(false)

const isPublic = computed(() => route.meta?.public)

const sidebar = ref<HTMLDivElement>()

const { hooks } = useNuxtApp()

/** when page suspensions have finished, check if a sidebar element was teleported into the layout */
hooks.hook('page:finish', () => {
  if (sidebar.value) {
    hasSider.value = sidebar.value?.children.length > 0
  }
})
</script>

<script lang="ts">
export default {
  name: 'DocsLayout',
}
</script>

<template>
  <NuxtLayout name="new">
    <template #navbar>
      <div v-if="!isPublic" class="flex flex-row justify-end w-full mr-4">
        <GeneralShareProject />
      </div>
    </template>
    <template #sidebar>
      <slot name="sidebar" />
    </template>
    <a-layout-content>
      <slot />
    </a-layout-content>
  </NuxtLayout>
</template>

<style lang="scss">
.ant-layout {
  @apply !overflow-y-hidden;
}
.ant-layout-content {
  @apply !overflow-y-hidden;
}
.nc-lang-btn {
  @apply color-transition flex items-center justify-center fixed bottom-10 right-10 z-99 w-12 h-12 rounded-full shadow-md shadow-gray-500 p-2 !bg-primary text-white ring-opacity-100 active:(ring ring-accent) hover:(ring ring-accent);

  &::after {
    @apply rounded-full absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
    content: '';
    z-index: -1;
  }

  &:hover::after {
    @apply transform scale-110 ring ring-accent ring-opacity-100;
  }

  &:active::after {
    @apply ring ring-accent ring-opacity-100;
  }
}

.doc-search {
  @apply !rounded-md !bg-gray-100;
  input.ant-input {
    @apply !bg-gray-100;
    // placeholder
    &::placeholder {
      @apply !text-gray-500 text-xs pl-1;
    }
  }
}
</style>
