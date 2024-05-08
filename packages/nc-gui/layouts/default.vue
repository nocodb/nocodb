<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

const route = useRoute()

const { te, t } = useI18n()

const { hasSidebar } = useSidebar('nc-left-sidebar')

const refreshSidebar = ref(false)

const sidebarReady = ref(false)

useTitle(route.meta?.title && te(route.meta.title) ? `${t(route.meta.title)}` : 'NocoDB')

watch(hasSidebar, (val) => {
  if (!val) {
    refreshSidebar.value = true
    nextTick(() => {
      refreshSidebar.value = false
    })
  }
})

onMounted(() => {
  until(() => document.querySelector('#nc-sidebar-left'))
    .toBeTruthy()
    .then(() => {
      sidebarReady.value = true
    })
})
</script>

<script lang="ts">
export default {
  name: 'DefaultLayout',
}
</script>

<template>
  <div class="w-full h-full">
    <Teleport v-if="sidebarReady" :to="hasSidebar ? '#nc-sidebar-left' : null" :disabled="!hasSidebar">
      <slot v-if="!refreshSidebar" name="sidebar" />
    </Teleport>

    <a-layout-content>
      <slot />
    </a-layout-content>
  </div>
</template>
