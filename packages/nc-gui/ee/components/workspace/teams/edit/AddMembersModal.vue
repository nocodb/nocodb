<script lang="ts" setup>
import { TeamUserRoles, type TeamV3V3Type, type UserType } from 'nocodb-sdk'
import type { TeamMember } from './MembersSection.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    team: TeamV3V3Type
    teamMembers: TeamMember[]
  }>(),
  {
    teamMembers: () => [],
  },
)

const emits = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:team', value: TeamV3V3Type): void
}>()

const visible = useVModel(props, 'visible', emits)

const team = useVModel(props, 'team', emits)

const { teamMembers } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { collaborators, activeWorkspaceId } = storeToRefs(workspaceStore)

const selectedUserIds = ref<string[]>([])

const teamMembersMap = computed(() => {
  return teamMembers.value.reduce((acc, member) => {
    acc[member.user_id] = member
    acc[member.user_email] = member
    return acc
  }, {} as Record<string, TeamMember>)
})

const ncListData = computed<NcListItemType[]>(() => {
  return (collaborators.value || []).map((coll) => {
    const isDisabled = teamMembersMap.value[coll.fk_user_id!] || teamMembersMap.value[coll.email!]
    return {
      ...coll,
      ncItemDisabled: !!isDisabled,
      ncItemTooltip: isDisabled ? t('objects.teams.alreadyPartOfTeam') : '',
    }
  })
})

const selectedUsers = computed(() => {
  return ncListData.value.filter((user) => selectedUserIds.value.includes(user.fk_user_id!) && !user.ncItemDisabled)
})

const isLoading = ref(false)

const isError = ref(false)

// Handle add members
const handleAddMembers = async () => {
  isLoading.value = true

  const membersToAdd = selectedUsers.value.map((user) => {
    return {
      user_id: user.fk_user_id!,
      team_role: TeamUserRoles.MEMBER,
    }
  })

  const addedMembers = await workspaceStore.addTeamMembers(activeWorkspaceId.value!, team.value.id, membersToAdd)

  if (addedMembers && ncIsArray(addedMembers)) {
    message.success({
      content: t(`objects.teams.nMember${membersToAdd.length > 1 ? 's' : ''}HaveBeenAddedIntoTeam`, {
        n: membersToAdd.length,
        team: team.value.title,
      }),
      showDuration: false,
    })

    visible.value = false
  }

  isLoading.value = false
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
    if (!newValue) {
      isError.value = false
      return
    }

    selectedUserIds.value = []

    selectedUserIds.value = teamMembers.value.map((member) => member.user_id || member.fk_user_id).filter(Boolean) as string[]
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
        <span
          v-dompurify-html="$t('objects.teams.selectMembersToAddIntoTeam', { team: `<strong>${team.title}</strong>` })"
        ></span>
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
        class="!w-auto border-1 border-nc-border-gray-medium rounded-lg"
        :filter-option="filterOption"
        empty-description="No users found"
        item-tooltip-placement="left"
        @change="handleUpdateValue($event)"
      >
        <template #listItemExtraLeft="{ isSelected, option }">
          <NcCheckbox :checked="isSelected" :disabled="option.ncItemDisabled" />
        </template>

        <template #listItemContent="{ option }">
          <NcUserInfo :user="option as UserType" :disabled="option.ncItemDisabled" class="w-[calc(100%_-_24px)]" />
        </template>
        <template #listItemExtraRight="{ option }">
          <div class="flex items-center gap-1">
            <RolesBadge :border="false" :role="option.roles" icon-only nc-badge-class="!px-1" show-tooltip>
              <template #tooltip="{ label }">
                {{ $t('tooltip.workspacePermissionRole', { role: $t(`objects.roleType.${label}`) }) }}
              </template>
            </RolesBadge>
          </div>
        </template>
        <template #listItemSelectedIcon> <NcSpanHidden /> </template>
      </NcList>

      <NcAlert
        v-if="isError"
        type="error"
        :message="$t('objects.teams.unableToAddMembers')"
        :description="$t('msg.error.somethingWentWrongTryAgainLater')"
        class="mt-4 !p-3"
      >
      </NcAlert>

      <div class="flex items-center justify-between pt-4">
        <div v-if="selectedUsers.length" class="text-nc-content-gray-muted">
          {{ t(`objects.teams.nMember${selectedUsers.length > 1 ? 's' : ''}Selected`, { n: selectedUsers.length }) }}
        </div>
        <div v-else>&nbsp;</div>
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
