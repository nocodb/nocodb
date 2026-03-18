<script setup lang="ts">
const router = useRouter()
const route = router.currentRoute

const { user } = useGlobal()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const isCreateWsDlgOpen = ref(false)

const isHomeActive = computed(() => {
  return (route.value.name as string) === 'index-home'
})

const navigateToHome = () => {
  navigateTo('/home')
}

const navigateToWorkspace = (wsId: string) => {
  navigateTo(`/${wsId}`)
}

const name = computed(() => user.value?.display_name?.trim())
</script>

<template>
  <div
    class="nc-home-sidebar flex flex-col h-full bg-nc-bg-gray-sidebar border-r-1 border-nc-border-gray-light select-none"
  >
    <!-- Brand -->
    <div class="flex items-center gap-2 px-4 h-[var(--topbar-height)] flex-none">
      <GeneralIcon icon="nocodb1" class="h-6 w-6 flex-none" />
      <span class="text-sm font-bold text-nc-content-gray">NocoDB</span>
    </div>

    <!-- Home nav item -->
    <div class="px-2 mb-1">
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors"
        :class="{
          'bg-nc-bg-gray-medium text-nc-content-gray': isHomeActive,
          'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light': !isHomeActive,
        }"
        data-testid="nc-home-sidebar-home"
        @click="navigateToHome"
      >
        <GeneralIcon icon="ncHome" class="h-4 w-4 flex-none" />
        <span class="text-sm font-medium">{{ $t('general.home') }}</span>
      </div>
    </div>

    <!-- Workspaces section -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-4 py-1.5">
        <span class="text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
          {{ $t('labels.workspaces') }}
        </span>
        <NcButton type="text" size="xxsmall" data-testid="nc-home-sidebar-create-ws" @click="isCreateWsDlgOpen = true">
          <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
        </NcButton>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-2">
        <div
          v-for="ws in workspacesList"
          :key="ws.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors mb-0.5"
          :class="{
            'bg-nc-bg-gray-medium': activeWorkspaceId === ws.id && !isHomeActive,
            'hover:bg-nc-bg-gray-light': activeWorkspaceId !== ws.id || isHomeActive,
          }"
          :data-testid="`nc-home-sidebar-ws-${ws.id}`"
          @click="navigateToWorkspace(ws.id!)"
        >
          <GeneralWorkspaceIcon :workspace="ws" size="small" />
          <NcTooltip show-on-truncate-only class="flex-1 truncate text-sm text-nc-content-gray">
            <template #title>{{ ws.title }}</template>
            {{ ws.title }}
          </NcTooltip>
        </div>
      </div>
    </div>

    <!-- Bottom section -->
    <div class="flex-none border-t-1 border-nc-border-gray-light p-2">
      <!-- User info -->
      <div class="flex items-center gap-2 px-2 py-1.5">
        <GeneralUserIcon :user="user" size="medium" class="flex-none" />
        <div class="flex-1 min-w-0">
          <NcTooltip show-on-truncate-only class="truncate text-sm text-nc-content-gray block">
            <template #title>{{ name || user?.email }}</template>
            {{ name || user?.email }}
          </NcTooltip>
          <NcTooltip
            v-if="name"
            show-on-truncate-only
            class="truncate text-xs text-nc-content-gray-muted block"
          >
            <template #title>{{ user?.email }}</template>
            {{ user?.email }}
          </NcTooltip>
        </div>
      </div>
    </div>

    <!-- Create workspace dialog -->
    <LazyWorkspaceCreateDlg v-model:model-value="isCreateWsDlgOpen" />
  </div>
</template>

<style lang="scss" scoped>
.nc-home-sidebar {
  width: 100%;
}
</style>
