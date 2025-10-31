<script lang="ts" setup>
import { type TeamV3V3Type } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'

const props = withDefaults(
  defineProps<{
    value: RawValueType
    teams?: TeamV3V3Type[]
    existingTeamIds?: string[]
    onChange: (team: RawValueType) => void | Promise<any>
    size?: 'sm' | 'md' | 'lg'
    placement?: 'bottomRight' | 'bottomLeft'
    isMultiSelect?: boolean
    defaultSlotWrapperClass?: string
  }>(),
  {
    description: true,
    size: 'lg',
    placement: 'bottomLeft',
    onChange: () => Promise.resolve(),
    isMultiSelect: false,
    defaultSlotWrapperClass: '',
  },
)

const { value, placement } = toRefs(props)

const workspaceStore = useWorkspace()

const { teams: teamList } = storeToRefs(workspaceStore)

const { t } = useI18n()

const isDropdownOpen = ref(false)

const newTeam = ref<null | string>(null)

function compareValue(_value: string | number, oldValue = value.value): boolean {
  if (props.isMultiSelect) {
    return ((oldValue as MultiSelectRawValueType) || []).includes(_value)
  }

  return oldValue === _value
}

async function onChangeTeam(val: SelectValue) {
  if (props.isMultiSelect && deepCompare(value.value, val)) return
  if (!props.isMultiSelect && val === value.value) return

  newTeam.value = val as string

  await props.onChange?.(props.isMultiSelect ? (val as MultiSelectRawValueType) : (val as string))

  newTeam.value = null
}

const teamSelectorOptions = computed<NcListItemType[]>(() => {
  return (props.teams || teamList.value || [])
    .filter((team) => !props.existingTeamIds?.includes(team.id))
    .map(
      (team): NcListItemType => ({
        ...team,
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
      :default-slot-wrapper-class="`w-full ${size === 'lg' ? '!h-10' : ''} ${defaultSlotWrapperClass}`"
      :placement="placement"
    >
      <div class="w-[calc(100%_-_24px)] flex items-center gap-2">
        <NcRenderVisibleItems v-if="selectedTeams.length" :items="selectedTeams" :icon-width="20" :padding-x="16" class="w-full">
          <template #default="{ visibleItems }">
            <div
              v-for="selectedTeam of visibleItems"
              :key="selectedTeam.value"
              class="flex items-center gap-2 border-1 border-nc-border-gray-medium rounded-xl pr-2 truncate"
            >
              <GeneralTeamIcon :team="selectedTeam" class="!rounded-full" />

              {{ selectedTeam?.label }}
            </div>
          </template>
        </NcRenderVisibleItems>

        <span v-if="!selectedTeams.length" class="text-nc-content-gray-muted">
          -{{ isMultiSelect ? t('labels.selectOneOrMoreTeams') : t('labels.selectTeam') }}-
        </span>
      </div>
      <GeneralIcon
        icon="chevronDown"
        class="flex-none h-4 w-4 text-nc-content-gray-muted transition-transform"
        :class="{ 'transform rotate-180': isDropdownOpen }"
      />

      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isDropdownOpen"
          :value="value"
          :list="teamSelectorOptions"
          :item-height="48"
          :is-multi-select="isMultiSelect"
          :close-on-select="!isMultiSelect"
          class="!w-auto"
          :is-locked="!!newTeam"
          :empty-description="
            !teamSelectorOptions.length && existingTeamIds?.length ? $t('objects.teams.noMoreTeamsToAdd') : undefined
          "
          variant="default"
          item-class-name="nc-team-select-dropdown"
          :wrapper-class-name="`!h-auto nc-team-selector-dropdown ${!!newTeam ? '!cursor-wait' : ''}`"
          @update:value="onChangeTeam"
          @escape="onEsc"
        >
          <template #listItem="{ option }">
            <div class="w-full flex gap-2" :class="`nc-team-select-${option.value}`">
              <GeneralTeamInfo :team="option" class="flex-1 max-w-[100%_-_32px]" />
              <GeneralLoader v-if="compareValue(option.value, newTeam)" size="medium" />
              <GeneralIcon v-else-if="!newTeam && compareValue(option.value)" icon="check" class="text-primary h-4 w-4" />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
