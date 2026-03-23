<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const props = defineProps<{
  workspaces: WorkspaceType[]
  selectedWorkspaceId: string | null
  baseCount: number
  canCreateWorkspace: boolean
  baseListAllWsMap?: Record<string, { plan_title: string | null }>
}>()

const emit = defineEmits<{
  select: [workspaceId: string]
  create: []
}>()

const { canCreateWorkspace } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const isDropdownOpen = ref(false)

const selectedWorkspace = computed(() => {
  return props.workspaces.find((ws) => ws.id === props.selectedWorkspaceId)
})

// Build workspace list for dropdown
const workspaceOptions = computed<NcListItemType[]>(() => {
  return props.workspaces.map((ws) => {
    const locked = workspaceStore.isWorkspaceCeLocked(ws.id)
    return {
      value: ws.id!,
      label: ws.title || '',
      ncItemExtra: locked ? t('title.availableWithLicense') : ws.payment?.plan?.title || 'Free',
      ncItemDisabled: locked,
      ncItemTooltip: locked ? t('title.activateLicenseToAccess') : undefined,
    }
  })
})

const onSelectWorkspace = (value: string) => {
  if (workspaceStore.isWorkspaceCeLocked(value)) return

  emit('select', value)
  isDropdownOpen.value = false
}

const onCreateWorkspace = () => {
  emit('create')
  isDropdownOpen.value = false
}
</script>

<template>
  <div class="nc-workspace-selector flex items-center gap-2 px-4 py-3 border-b border-nc-border-gray-medium">
    <NcListDropdown v-model:is-open="isDropdownOpen" :default-slot-wrapper="false" class="flex-1">
      <div
        class="flex items-center gap-3 px-3 py-2 rounded-lg border-1 border-nc-border-gray-medium hover:border-nc-border-gray-dark cursor-pointer transition-all"
        :class="{ 'border-nc-border-brand shadow-selected': isDropdownOpen }"
      >
        <GeneralWorkspaceIcon v-if="selectedWorkspace" :workspace="selectedWorkspace" size="medium" class="flex-none" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-nc-content-gray-extreme truncate capitalize">
            {{ selectedWorkspace?.title || t('objects.workspace') }}
          </div>
          <div class="flex items-center gap-2 text-xs text-nc-content-gray-muted">
            <span>{{
              selectedWorkspace?.payment?.plan?.title || baseListAllWsMap?.[selectedWorkspace?.id!]?.plan_title || 'Free'
            }}</span>
            <span class="w-1 h-1 rounded-full bg-nc-content-gray-muted" />
            <span>{{ baseCount }} {{ baseCount !== 1 ? $t('objects.projects') : $t('objects.project') }}</span>
          </div>
        </div>
        <GeneralIcon
          icon="chevronDown"
          class="flex-none w-4 h-4 text-nc-content-gray-muted transition-transform"
          :class="{ 'transform rotate-180': isDropdownOpen }"
        />
      </div>

      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isDropdownOpen"
          :value="selectedWorkspaceId || ''"
          :list="workspaceOptions"
          variant="medium"
          class="!w-auto min-w-[280px]"
          :show-search-always="workspaces.length > 5"
          search-input-placeholder="Search workspaces..."
          @update:value="onSelectWorkspace"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <GeneralWorkspaceIcon :workspace="workspaces.find((ws) => ws.id === option.value)" size="small" class="flex-none" />
          </template>
          <template #listItemExtraRight="{ option }">
            <span class="text-xs text-nc-content-gray-muted">
              {{ option.ncItemExtra }}
            </span>
          </template>
          <template v-if="canCreateWorkspace" #listFooter>
            <NcDivider class="!my-0" />
            <div class="p-2">
              <NcButton type="text" size="small" class="w-full !justify-start" @click="onCreateWorkspace">
                <template #icon>
                  <GeneralIcon icon="plus" class="flex-none" />
                </template>
                {{ $t('activity.newWorkspace') }}
              </NcButton>
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-selector {
  @apply dark:bg-nc-bg-gray-extralight;
}
</style>
