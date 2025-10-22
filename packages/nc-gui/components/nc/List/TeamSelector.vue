<script lang="ts" setup>
import { type TeamV3V3Type } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'

const props = withDefaults(
  defineProps<{
    value: RawValueType
    teams?: TeamV3V3Type[]
    onChange: (team: RawValueType) => void | Promise<any>
    border?: boolean
    description?: boolean
    inherit?: string
    size?: 'sm' | 'md' | 'lg'
    placement?: 'bottomRight' | 'bottomLeft'
    isMultiSelect?: boolean
    defaultSlotWrapperClass?: string
  }>(),
  {
    border: true,
    description: true,
    size: 'lg',
    placement: 'bottomLeft',
    onChange: () => Promise.resolve(),
    isMultiSelect: false,
    defaultSlotWrapperClass: '',
  },
)

const { value, placement, description } = toRefs(props)

const workspaceStore = useWorkspace()

const { teams } = storeToRefs(workspaceStore)

const { t } = useI18n()

const isDropdownOpen = ref(false)

const newTeam = ref<null | string>(null)

async function onChangeTeam(val: SelectValue) {
  if (val === value.value) return

  newTeam.value = val as string

  await props.onChange?.(val as string)

  newTeam.value = null
}

const teamSelectorOptions = computed<NcListItemType[]>(() => {
  return (props.teams || teams.value || []).map(
    (team): NcListItemType => ({
      value: team.id,
      label: team.title,
      description: `${team.members_count || 0} ${t('labels.members')}`,
      icon: team.icon,
      icon_type: team.icon_type,
    }),
  )
})

const selectedTeams = computed(() => {
  return teamSelectorOptions.value.filter((team) => {
    if (props.isMultiSelect) {
      return team.value && (value.value as MultiSelectRawValueType)?.includes(team.value as string)
    } else {
      return team.value && team.value === (value.value as string)
    }
  }) as NcListItemType[]
})
</script>

<template>
  <div class="nc-roles-selector relative flex items-center w-full">
    <NcListDropdown
      v-model:visible="isDropdownOpen"
      :default-slot-wrapper-class="`flex-1 ${size === 'lg' ? '!h-10' : ''} ${defaultSlotWrapperClass}`"
      :placement="placement"
    >
      <div class="flex items-center gap-2">
        <div v-for="selectedTeam of selectedTeams" :key="selectedTeam.value" class="flex items-center gap-2">
          <GeneralTeamIcon :icon="selectedTeam?.icon" :icon-type="selectedTeam?.icon_type" />

          {{ selectedTeam?.label }}
        </div>

        <span v-if="!selectedTeams.length" class="text-nc-content-gray-muted">
          -{{ isMultiSelect ? t('labels.selectTeams') : t('labels.selectTeam') }}-
        </span>
      </div>

      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isDropdownOpen"
          :value="value"
          :list="teamSelectorOptions"
          :item-height="48"
          :is-multi-select="isMultiSelect"
          class="!w-auto"
          :isLocked="!!newTeam"
          variant="default"
          item-class-name="nc-team-select-dropdown"
          :wrapper-class-name="`!h-auto nc-team-selector-dropdown ${!!newTeam ? '!cursor-wait' : ''}`"
          @update:value="onChangeTeam"
          @escape="onEsc"
        >
          <template #listItem="{ option }">
            <div class="w-full flex flex-col" :class="`nc-team-select-${option.value}`">
              <div class="w-full flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <GeneralTeamIcon :icon="option.icon" :icon-type="option.icon_type" />

                  <span class="text-captionDropdownDefault">
                    {{ option.label }}
                  </span>
                </div>
                <GeneralLoader v-if="option.value === newTeam" size="medium" />
                <GeneralIcon v-else-if="!newTeam && option.value === value" icon="check" class="text-primary h-4 w-4" />
              </div>
              <div v-if="description" class="text-bodySm !font-light text-nc-content-gray-muted ml-6">
                {{ option.description }}
              </div>
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
