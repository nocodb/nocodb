<script lang="ts" setup>
import type { UserType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  team: TeamType
}>()

const emits = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:team', value: TeamType): void
}>()

const visible = useVModel(props, 'visible', emits)

const selectedUserIds = ref<string[]>([])

const team = useVModel(props, 'team', emits)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { collaborators, collaboratorsMap } = storeToRefs(workspaceStore)

watchEffect(()=>{
    console.log('team', team.value)
})

const ncListData = computed<NcListItemType[]>(() => {
  return (collaborators.value || []).map((coll) => {
    const isDisabled = team.value.members.includes(coll.fk_user_id!) || team.value.members.includes(coll.email!)
    return {
      ...coll,
      ncItemDisabled: isDisabled,
      ncItemTooltip: isDisabled ? t('objects.teams.alreadyPartOfTeam') : '',
    }
  })
})

const selectedUsers = computed(() => {
  return ncListData.value.filter((user) => selectedUserIds.value.includes(user.fk_user_id!) && !user.ncItemDisabled)
})

// Search functionality
const isLoading = ref(false)

// Handle add members
const handleAddMembers = async () => {
  isLoading.value = true
  try {
    team.value.members.push(...selectedUsers.value.map((user) => user.email))
    // Todo: API call
    visible.value = false
  } catch (e: any) {
    message.error('Failed to add members')
  } finally {
    isLoading.value = false
  }
}

const filterOption = (input: string, option: NcListItemType) => {
  return antSelectFilterOption(input, option, ['email', 'display_name'])
}

const toggleUser = (userId: string) => {
  if (selectedUserIds.value.includes(userId)) {
    selectedUserIds.value = selectedUserIds.value.filter((id) => id !== userId)
  } else {
    selectedUserIds.value.push(userId)
  }
}

const handleUpdateValue = (option: NcListItemType) => {
  toggleUser(option.id)
}

watch(
  visible,
  (newValue) => {
    if (!newValue) return

    team.value.members.forEach((member) => {
      const user = collaboratorsMap.value[member]

      if (user && !selectedUserIds.value.includes(user.fk_user_id!)) {
        selectedUserIds.value.push(user.fk_user_id!)
      }
    })
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <GeneralModal
    v-model:visible="visible"
    :class="{ active: visible }"
    :mask-closable="false"
    :keyboard="!isLoading"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-teams-add-members"
    :footer="null"
    class="!w-[448px]"
    :closable="false"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="text-subHeading2 text-nc-content-gray-emphasis">
          {{ $t('objects.teams.addMembersToTeam') }}
        </div>
      </div>

      <div class="text-body text-nc-content-gray-subtle mb-5">
        {{ $t('objects.teams.selectMembersToAddIntoTeam', { team: team.title }) }}
      </div>

      <NcList
        ref="listRef"
        :open="visible"
        :value="selectedUserIds"
        :list="ncListData"
        option-label-key="email"
        option-value-key="fk_user_id"
        :item-height="52"
        search-input-placeholder="Search user"
        is-multi-select
        class="!w-auto"
        :filter-option="filterOption"
        empty-description="No users found"
        item-tooltip-placement="left"
        @change="handleUpdateValue($event)"
      >
        <template #listItemExtraLeft="{ isSelected, option }">
          <NcCheckbox :checked="isSelected" :disabled="option.ncItemDisabled" />
        </template>

        <template #listItemContent="{ option }">
          <NcUserInfo :user="option as UserType" class="w-[calc(100%_-_24px)]" />
        </template>
        <template #listItemExtraRight="{ option }">
          <div class="flex items-center gap-1">
            <RolesBadge :border="false" :role="option.roles" icon-only nc-badge-class="!px-1" show-tooltip />
          </div>
        </template>
        <template #listItemSelectedIcon> <NcSpanHidden /> </template>
      </NcList>

      <div class="flex items-center justify-end pt-4 border-t border-nc-border-gray-light">
        <div class="flex gap-2">
          <NcButton type="secondary" size="small" :disabled="isLoading" @click="visible = false"> Cancel </NcButton>
          <NcButton
            type="primary"
            size="small"
            :loading="isLoading"
            :disabled="isLoading || selectedUsers.length === 0"
            @click="handleAddMembers"
          >
            {{ selectedUsers.length > 1 ? $t('activity.addMembers') : $t('labels.addMember') }}
          </NcButton>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>
