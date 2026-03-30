<script setup lang="ts">
import type { TeamV3V3Type } from 'nocodb-sdk'

interface Props {
  visible: boolean
  team: TeamV3V3Type | null
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { team } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { teams, activeWorkspaceId } = storeToRefs(workspaceStore)

const { moveTeam, getTeamDescendantIds, getTeamBreadcrumb } = workspaceStore

const { workspaceRoles } = useRoles()

const isWsOwner = computed(() => !!workspaceRoles.value?.['workspace-level-owner'])

const canAddSubTeam = (t: any) => t.is_owner || isWsOwner.value

const isMoving = ref(false)

const selectedParentId = ref<string | null>(null)

const breadcrumb = computed(() => {
  if (!team.value) return []
  return getTeamBreadcrumb(team.value.id)
})

const parentTeamOptions = computed(() => {
  if (!team.value) return []

  const descendantIds = new Set(getTeamDescendantIds(team.value.id))

  const eligible = (teams.value || []).filter((t: any) => {
    if (t.id === team.value!.id) return false
    if (descendantIds.has(t.id)) return false
    if ((t.depth ?? 0) >= 3) return false
    return true
  })

  const childrenMap = new Map<string | null, typeof eligible>()
  for (const t of eligible) {
    const parentId = (t as any).fk_parent_team_id || null
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
    childrenMap.get(parentId)!.push(t)
  }

  for (const siblings of childrenMap.values()) {
    siblings.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }

  const ordered: typeof eligible = []
  const walk = (parentId: string | null) => {
    for (const child of childrenMap.get(parentId) ?? []) {
      ordered.push(child)
      walk(child.id)
    }
  }
  walk(null)
  return ordered
})

const hasChanged = computed(() => {
  if (!team.value) return false
  const currentParent = (team.value as any).fk_parent_team_id || null
  return selectedParentId.value !== currentParent
})

const handleMoveTeam = async () => {
  if (isMoving.value || !team.value || !hasChanged.value) return

  try {
    isMoving.value = true
    const res = await moveTeam(activeWorkspaceId.value!, team.value.id, selectedParentId.value)
    if (res) {
      message.success(t('msg.success.teamMoved'))
      vVisible.value = false
    }
  } finally {
    isMoving.value = false
  }
}

watch(vVisible, (newValue) => {
  if (!newValue || !team.value) return

  selectedParentId.value = (team.value as any).fk_parent_team_id || null
})
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    :header="$t('labels.moveTeam')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    :mask-closable="!isMoving"
    wrap-class-name="nc-modal-team-move-wrapper"
  >
    <div class="py-4 md:py-5 flex flex-col gap-5">
      <div class="px-4 md:px-5 flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray capitalize">
          <GeneralIcon icon="ncMove" class="!text-nc-content-gray-subtle2 w-5 h-5" />
          {{ $t('labels.moveTeam') }}
        </div>
      </div>

      <div class="flex flex-col gap-5 !px-4 md:!px-5">
        <!-- Current team info -->
        <div>
          <div class="text-bodyDefaultSm text-nc-content-gray-subtle mb-1">{{ $t('objects.team') }}</div>
          <div class="flex items-center gap-2">
            <GeneralTeamIcon :team="team" class="!w-6 !h-6 !min-w-6 flex-none !rounded-md" />
            <span class="text-sm font-medium text-nc-content-gray">{{ team?.title }}</span>
          </div>
        </div>

        <!-- Current hierarchy -->
        <div v-if="breadcrumb.length > 1">
          <div class="text-bodyDefaultSm text-nc-content-gray-subtle mb-1">{{ $t('labels.teamHierarchy') }}</div>
          <div class="flex items-center gap-1 text-sm text-nc-content-gray-subtle flex-wrap">
            <template v-for="(crumb, idx) in breadcrumb" :key="crumb.id">
              <span :class="idx === breadcrumb.length - 1 ? 'text-nc-content-gray font-medium' : ''">
                {{ crumb.title }}
              </span>
              <GeneralIcon
                v-if="idx < breadcrumb.length - 1"
                icon="ncArrowRight"
                class="h-3.5 w-3.5 text-nc-content-gray-muted"
              />
            </template>
          </div>
        </div>

        <!-- Parent team selector -->
        <div>
          <div class="text-bodyDefaultSm text-nc-content-gray mb-1">
            {{ $t('labels.parentTeam') }}
          </div>
          <NcSelect
            v-model:value="selectedParentId"
            :placeholder="$t('general.none')"
            allow-clear
            show-search
            :disabled="isMoving"
            :filter-option="(input: string, option: any) => option['data-label']?.toLowerCase().includes(input.toLowerCase())"
            class="w-full nc-select-shadow"
            data-testid="move-team-parent-select"
            dropdown-class-name="nc-dropdown-move-team-parent"
          >
            <a-select-option
              v-for="pt in parentTeamOptions"
              :key="pt.id"
              :value="pt.id"
              :data-label="pt.title"
              :disabled="!canAddSubTeam(pt)"
            >
              <NcTooltip
                :disabled="canAddSubTeam(pt)"
                :title="t('msg.info.onlyTeamManagerCanAddSubTeam')"
                placement="left"
              >
                <div
                  class="flex items-center gap-2"
                  :class="{ 'opacity-60': !canAddSubTeam(pt) }"
                  :style="{ paddingLeft: `${(pt.depth ?? 0) * 16}px` }"
                >
                  <GeneralTeamIcon :team="pt" class="!w-5 !h-5 !min-w-5 flex-none !rounded-md" />
                  <NcTooltip class="truncate flex-1" show-on-truncate-only :disabled="!canAddSubTeam(pt)">
                    <template #title>{{ pt.title }}</template>
                    {{ pt.title }}
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="selectedParentId === pt.id"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4 flex-none"
                  />
                </div>
              </NcTooltip>
            </a-select-option>
          </NcSelect>
        </div>

        <!-- Actions -->
        <div class="flex flex-row items-center justify-end gap-2">
          <NcButton type="secondary" size="small" :disabled="isMoving" @click="vVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            v-e="['a:team:move']"
            type="primary"
            size="small"
            :disabled="!hasChanged || isMoving"
            :loading="isMoving"
            @click="handleMoveTeam"
          >
            {{ $t('labels.moveTeam') }}
            <template #loading> {{ $t('labels.moveTeam') }} </template>
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>
