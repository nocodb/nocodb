<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const base = inject(ProjectInj)!

const { isUIAllowed, baseRoles } = useRoles()

const resolveBaseId = () => {
  if (route.value.params.baseId) return route.value.params.baseId as string
  if (base.value?.id) return base.value.id

  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolved = basesList.value.find((b) => b.id === lastVisitedBaseId) || basesList.value[0]
  return resolved?.id
}

const navigateToBaseSettings = (page: string) => {
  const baseId = resolveBaseId()
  if (!baseId) return

  const wsId = route.value.params.typeOrId
  const slug = adminTabToSlug[page] || page
  navigateTo(`/${wsId}/${baseId}/settings/${slug}`)
}

const activeAdminPage = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  return (route.value.params.page as string) || ''
})

const isAdminItemActive = (tab: string) => {
  const slug = adminTabToSlug[tab] || tab
  return activeAdminPage.value === slug
}
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-admin-section-header">
      {{ $t('labels.baseSettings') }}
    </div>
    <NcSidebarMenuItem
      v-if="isUIAllowed('newUser', { roles: baseRoles })"
      v-e="['c:admin:base:add-user']"
      icon="users"
      :active="isAdminItemActive('collaborator')"
      @click="navigateToBaseSettings('collaborator')"
    >
      {{ $t('labels.addUserToBase') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('manageMCP')"
      v-e="['c:admin:base:mcp']"
      icon="mcp"
      :active="isAdminItemActive('mcp')"
      @click="navigateToBaseSettings('mcp')"
    >
      {{ $t('title.mcpServer') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('sourceCreate')"
      v-e="['c:admin:base:add-data-source']"
      icon="ncDatabase"
      :active="isAdminItemActive('data-source')"
      @click="navigateToBaseSettings('data-source')"
    >
      {{ $t('labels.addDataSource') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-e="['c:admin:base:more']"
      icon="ncMoreHorizontal"
      :active="isAdminItemActive('base-settings')"
      @click="navigateToBaseSettings('base-settings')"
    >
      {{ $t('general.general') }}
    </NcSidebarMenuItem>
  </div>
</template>

<style lang="scss" scoped>
.nc-admin-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
