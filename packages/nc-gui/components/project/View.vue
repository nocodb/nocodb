<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

// The base's own page: topbar plus the overview for whichever sidebar vertical
// is active. Base settings used to live here too, as a headless tab set behind
// a `tab` prop; it is now the settings shell (`ProjectSettingsShell`), a modal
// the settings route mounts over this page.

const props = defineProps<{
  baseId?: string
  showEmptySkeleton?: boolean
}>()

const { hideSidebar } = storeToRefs(useSidebarStore())

const { integrations } = useProvideIntegrationViewStore()

const basesStore = useBases()

const { openedProject, bases } = storeToRefs(basesStore)

const { activeTable } = storeToRefs(useTablesStore())

const { activeWorkspace } = storeToRefs(useWorkspace())

const { isSharedBase, isPrivateBase } = storeToRefs(useBase())

const { productName } = useBranding()

const { $api } = useNuxtApp()

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    base = bases.value.get(props.baseId)
    if (!base) base = await $api.base.read(props.baseId!)
  } else {
    base = openedProject.value
  }

  return base
})

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { isMobileMode } = useGlobal()

watch(
  () => [currentBase.value?.id, currentBase.value?.title],
  () => {
    if (activeTable.value?.title) return

    useTitle(`${currentBase.value?.title ?? activeWorkspace.value?.title ?? productName.value ?? 'NocoDB'}`)
  },
  {
    immediate: true,
  },
)

watch(
  () => currentBase.value?.id,
  () => {
    /**
     * When the current base ID changes, reset the integrations array.
     * This ensures that the integration data is cleared, allowing it to be reloaded
     * properly when opening the create/edit source modal with the updated base.
     */
    integrations.value = []
  },
  { immediate: true },
)

onMounted(() => {
  hideSidebar.value = false
})
</script>

<template>
  <div class="h-full nc-base-view">
    <div
      v-if="!isAdminPanel"
      class="flex flex-row px-2 py-2 gap-3 justify-between w-full border-b-1 border-nc-border-gray-medium"
      :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    >
      <div class="flex-1 max-w-full md:max-w-[calc(100%_-_100px)] flex flex-row items-center gap-x-3">
        <GeneralOpenLeftSidebarBtn />
        <div v-if="!showEmptySkeleton" class="flex flex-row items-center h-full gap-x-2 px-2 min-w-0">
          <GeneralProjectIcon
            :color="parseProp(currentBase?.meta).iconColor"
            :icon="parseProp(currentBase?.meta).icon"
            :type="currentBase?.type"
            :managed-app="{
              managed_app_master: currentBase?.managed_app_master,
              managed_app_id: currentBase?.managed_app_id,
            }"
            class="h-6 w-6 md:(h-4 w-4) flex-none"
          />
          <NcTooltip
            class="flex font-bold text-base md:text-sm capitalize truncate max-w-150 text-nc-content-gray"
            show-on-truncate-only
          >
            <template #title> {{ currentBase?.title }}</template>
            <span class="truncate">
              {{ currentBase?.title }}
            </span>
          </NcTooltip>
          <NcBadge
            v-if="isPrivateBase"
            size="xs"
            class="!text-bodySm !bg-nc-bg-gray-medium !text-nc-content-gray-subtle2"
            color="gray"
            :border="false"
          >
            <GeneralIcon icon="ncLock" class="w-3.5 h-3.5 mr-1" />
            {{ $t('general.private') }}
          </NcBadge>
        </div>
      </div>
      <div v-if="!showEmptySkeleton && !isMobileMode" class="flex items-center gap-2">
        <SmartsheetTopbarManagedAppSetupWarning />
        <SmartsheetTopbarManagedAppStatus />
        <!-- Base-level presence: this topbar backs base home, settings and docs, so
             without it the avatars vanish the moment a user steps off a table. -->
        <LazySmartsheetTopbarCollaboratorPresence v-if="!isSharedBase && isEeUI" />
        <LazySmartsheetTopbarHistory />
        <LazyGeneralShareProject />
      </div>
    </div>
    <div
      v-if="!showEmptySkeleton"
      class="nc-base-view-tab overflow-hidden"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <ProjectOverview />
    </div>
  </div>
</template>
