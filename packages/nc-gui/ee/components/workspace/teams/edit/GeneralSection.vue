<script lang="ts" setup>
import { IconType, PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

interface Props {
  team: TeamType
  readOnly: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const { isRtl } = useRtl()

const useForm = Form.useForm

const { team, readOnly } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { teams, activeWorkspaceId } = storeToRefs(workspaceStore)

const { blockTeamHierarchy } = useEeConfig()

const { workspaceRoles } = useRoles()

const isWsOwner = computed(() => !!workspaceRoles.value?.['workspace-level-owner'])

const canAddSubTeam = (t: any) => t.is_owner || isWsOwner.value

const { getTeamBreadcrumb, moveTeam, getTeamDescendantIds } = workspaceStore

// Todo: Enable this once we support team description
const showDescription = false

const inputEl = ref<HTMLInputElement>()

const isMoving = ref(false)

const breadcrumb = computed(() => {
  return getTeamBreadcrumb(team.value.id)
})

const parentTeamOptions = computed(() => {
  const descendantIds = new Set(getTeamDescendantIds(team.value.id))

  const eligible = (teams.value || []).filter((t: any) => {
    if (t.id === team.value.id) return false
    if (descendantIds.has(t.id)) return false
    if ((t.depth ?? 0) >= 3) return false
    return true
  })

  // Build parentId → children map for depth-first ordering
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

const selectedParentId = ref<string | null>(null)

const handleMoveTeam = async () => {
  if (isMoving.value || readOnly.value) return

  try {
    isMoving.value = true
    const res = await moveTeam(activeWorkspaceId.value!, team.value.id, selectedParentId.value)
    if (res) {
      message.success(t('msg.success.teamMoved'))
    }
  } finally {
    isMoving.value = false
  }
}

const formState = reactive<{
  title: string
  description: string
  icon: string
  icon_type: IconType | string

  // Todo: Phase II
  badge_color: string
}>({
  title: '',
  description: '',
  icon: '',
  icon_type: '',
  badge_color: undefined,
})

const validators = computed(() => {
  return {
    title: [
      validateTeamName,
      {
        validator: (_: any, value: any) => {
          return new Promise((resolve, reject) => {
            if (
              teams.value?.some(
                (t) => (t as any).scope !== 'org' && t.id !== team.value.id && t.title?.toLowerCase() === value?.toLowerCase(),
              )
            ) {
              return reject(new Error(t('msg.error.duplicateTeamName')))
            }

            return resolve(true)
          })
        },
      },
    ],
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const updating = ref(false)

const updateTeam = async (isIconUpdate = false) => {
  if (readOnly.value) return

  if (isIconUpdate && team.value?.icon === formState?.icon) return

  if (!isIconUpdate && team.value.title?.trim() === formState.title?.trim()) return

  try {
    updating.value = true
    if (!isIconUpdate) {
      await validate()
    }

    await workspaceStore.updateTeam(
      activeWorkspaceId.value!,
      team.value.id,
      isIconUpdate
        ? {
            icon: formState?.icon || null,
            icon_type: formState?.icon_type || null,
            // badge_color: formState?.badge_color,
          }
        : {
            title: formState.title,
          },
    )
  } catch (e: any) {
    console.error(e)
  } finally {
    updating.value = false
  }
}

const updateTeamWithDebounce = useDebounceFn(
  async () => {
    await updateTeam()
  },
  250,
  { maxWait: 3000 },
)

onMounted(() => {
  formState.title = team.value.title
  formState.description = team.value.description ?? ''
  formState.badge_color = team.value.badge_color ?? undefined
  formState.icon = team.value.icon ?? ''
  formState.icon_type = team.value.icon_type ?? ''
  selectedParentId.value = (team.value as any).fk_parent_team_id || null
})

watch(
  readOnly,
  (newVal) => {
    if (newVal) return

    forcedNextTick(() => {
      inputEl.value?.focus()
    })
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <div class="nc-modal-teams-edit-content-section mt-6">
    <div v-if="showDescription" class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('general.general') }}</div>
    <a-form
      layout="vertical"
      :model="formState"
      name="create-new-team-form"
      class="flex flex-col gap-4"
      @keydown.enter="updateTeam"
    >
      <a-form-item v-bind="validateInfos.title" class="relative nc-team-input-wrapper relative !mb-0">
        <template #label>
          {{ $t('general.name') }}
        </template>

        <div class="relative">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            class="nc-team-input nc-input-sm nc-input-shadow !pl-38"
            hide-details
            data-testid="create-team-title-input"
            :placeholder="$t('placeholder.enterTeamName')"
            :disabled="readOnly"
            @input="updateTeamWithDebounce"
          >
            <template #prefix> <div class="w-6">&nbsp;</div> </template>
          </a-input>
          <div class="absolute left-0 top-0 z-10">
            <GeneralIconSelector
              v-model:icon="formState.icon"
              v-model:icon-type="formState.icon_type"
              :default-active-tab="IconType.ICON"
              :tab-order="[IconType.ICON, IconType.EMOJI]"
              :hidden-tabs="[IconType.IMAGE]"
              :image-cropper-data="{}"
              :disabled="readOnly"
              @submit="() => updateTeam(true)"
            >
              <template #default="{ isOpen }">
                <div
                  class="border-1 w-8 h-8 flex-none rounded-lg overflow-hidden transition-all duration-300"
                  :class="{
                    'border-transparent !rounded-r-none border-r-nc-border-gray-medium': !isOpen,
                    'border-primary shadow-selected': isOpen,
                    'cursor-not-allowed': readOnly,
                    'cursor-pointer': !readOnly,
                  }"
                >
                  <GeneralTeamIcon
                    :team="formState"
                    show-placeholder-icon
                    class="!w-full !h-full !min-w-full select-none cursor-pointer !rounded-none"
                    :class="readOnly ? 'cursor-not-allowed' : 'cursor-pointer'"
                  />
                </div>
              </template>
            </GeneralIconSelector>
          </div>
        </div>
      </a-form-item>
      <a-form-item v-if="showDescription" class="!mb-0">
        <template #label>
          {{ $t('labels.description') }}
        </template>

        <a-textarea
          v-model:value="formState.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-nc-content-gray max-h-[150px] !min-h-[80px]"
          hide-details
          data-testid="create-team-description-input"
          :placeholder="$t('placeholder.enterTeamDescription')"
          :disabled="readOnly"
          @input="updateTeamWithDebounce"
        />
      </a-form-item>
    </a-form>

    <!-- Team hierarchy breadcrumb -->
    <div v-if="breadcrumb.length > 1" class="mt-4">
      <div class="text-[13px] text-nc-content-gray mb-2">{{ $t('labels.teamHierarchy') }}</div>
      <div class="flex items-center gap-1 text-sm text-nc-content-gray-subtle flex-wrap">
        <template v-for="(crumb, idx) in breadcrumb" :key="crumb.id">
          <span :class="idx === breadcrumb.length - 1 ? 'text-nc-content-gray font-medium' : ''">
            {{ crumb.title }}
          </span>
          <GeneralIcon v-if="idx < breadcrumb.length - 1" icon="ncArrowRight" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
        </template>
      </div>
    </div>

    <!-- Move team -->
    <PaymentUpgradeBadgeProvider v-if="!readOnly" :feature="PlanFeatureTypes.FEATURE_TEAM_HIERARCHY">
      <template #default="{ click }">
        <div class="mt-4">
          <div class="text-bodyDefaultSm text-nc-content-gray mb-2 flex items-center gap-2">
            {{ $t('labels.parentTeam') }}
            <PaymentUpgradeBadge
              :feature="PlanFeatureTypes.FEATURE_TEAM_HIERARCHY"
              :title="$t('upgrade.upgradeToUseTeamHierarchy')"
              :content="$t('upgrade.upgradeToUseTeamHierarchySubtitle', { plan: PlanTitles.ENTERPRISE })"
            />
          </div>
          <div class="flex items-center gap-2">
            <NcSelect
              v-model:value="selectedParentId"
              :placeholder="$t('general.none')"
              allow-clear
              show-search
              :filter-option="(input: string, option: any) => option['data-label']?.toLowerCase().includes(input.toLowerCase())"
              class="flex-1 nc-select-shadow"
              data-testid="edit-team-parent-select"
              dropdown-class-name="nc-dropdown-edit-team-parent"
              :disabled="isMoving || blockTeamHierarchy"
              @click="click(PlanFeatureTypes.FEATURE_TEAM_HIERARCHY, () => {})"
            >
              <a-select-option
                v-for="pt in parentTeamOptions"
                :key="pt.id"
                :value="pt.id"
                :data-label="pt.title"
                :disabled="!canAddSubTeam(pt)"
              >
                <NcTooltip :disabled="canAddSubTeam(pt)" :title="t('msg.info.onlyTeamManagerCanAddSubTeam')" placement="left">
                  <div
                    class="flex items-center gap-2"
                    :class="{ 'opacity-60': !canAddSubTeam(pt) }"
                    :style="isRtl ? { paddingRight: `${(pt.depth ?? 0) * 16}px` } : { paddingLeft: `${(pt.depth ?? 0) * 16}px` }"
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
            <NcButton
              v-if="selectedParentId !== ((team as any).fk_parent_team_id || null)"
              size="small"
              type="primary"
              :loading="isMoving"
              :disabled="isMoving"
              @click="click(PlanFeatureTypes.FEATURE_TEAM_HIERARCHY, handleMoveTeam)"
            >
              {{ $t('labels.moveTeam') }}
            </NcButton>
          </div>
        </div>
      </template>
    </PaymentUpgradeBadgeProvider>
  </div>
</template>
