<script lang="ts" setup>
import type { PermissionKey } from 'nocodb-sdk'
import { PermissionMeta, PermissionRoleMap, PermissionRolePower } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  selectedUsers: Set<string>
  baseId: string
  permissionLabel: string
  permissionDescription?: string
  permission?: PermissionKey
  entityTitle?: string
}>()

const emits = defineEmits(['update:visible', 'save'])

const visible = useVModel(props, 'visible', emits)

const selectedUsers = useVModel(props, 'selectedUsers', emits)

const { $e } = useNuxtApp()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

// Search functionality
const isLoading = ref(false)

const baseUsers = computed(() => {
  return basesUser.value.get(props.baseId) || []
})

// Handle save
const onSave = async () => {
  isLoading.value = true
  try {
    const selectedIds = Array.from(selectedUsers.value)
    const basesStore = useBases()
    const { basesTeams } = storeToRefs(basesStore)

    const users: PermissionSelectorUser[] = []

    for (const id of selectedIds) {
      // Check if it's a team
      const teams = basesTeams.value.get(props.baseId) || []
      const team = teams.find((team) => team.team_id === id)

      if (team) {
        users.push({
          id: team.team_id,
          display_name: team.team_title,
          type: 'team',
        })
      } else {
        // It's a user
        const user = baseUsers.value.find((user) => user.id === id)
        if (user) {
          users.push({
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            type: 'user',
          })
        }
      }
    }

    emits('save', {
      selectedUsers: users,
    })

    $e('a:permissions:users:save')
    visible.value = false
  } catch (e: any) {
    message.error('Failed to save user permissions')
  } finally {
    isLoading.value = false
  }
}

const userSelectorListRef = ref()

const description = computed(() => {
  return PermissionMeta[props.permission as PermissionKey].userSelectorDescription?.replace(
    '{{field}}',
    `<b class="text-nc-content-gray-emphasis">${props.entityTitle ?? 'this'}</b>`,
  )
})

const selectedBelowMinimumRoleUsers = computed(() => {
  if (!props.permission) return []

  const permissionMeta = PermissionMeta[props.permission]
  if (!permissionMeta) return []

  const minimumRolePower = PermissionRolePower[permissionMeta.minimumRole]
  if (!minimumRolePower) return []

  const selectedUsersArray = Array.from(selectedUsers.value)

  return selectedUsersArray.filter((userId) => {
    const user = baseUsers.value.find((user) => user.id === userId)
    if (!user) return false

    if (typeof user.roles === 'string') {
      const userRoles = (user.roles as string).split(',').map((r) => r.trim())
      return userRoles.some((role) => {
        const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
        const rolePower = PermissionRolePower[mappedRole]
        return rolePower && rolePower < minimumRolePower
      })
    }

    return Object.keys(user.roles ?? {}).some((role) => {
      const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
      const rolePower = PermissionRolePower[mappedRole]
      return rolePower && rolePower < minimumRolePower
    })
  })
})
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
    wrap-class-name="nc-modal-permissions-user-selector"
    :footer="null"
    class="!w-[448px]"
    :closable="false"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="text-subHeading2 text-nc-content-gray-emphasis">
          Select who can edit {{ entityTitle ? `"${entityTitle}"` : '' }}
        </div>
      </div>

      <div class="text-body text-nc-content-gray-subtle mb-5" v-html="description"></div>

      <div class="text-nc-content-gray text-caption mb-2">Select users</div>

      <PermissionsUserSelectorList
        ref="userSelectorListRef"
        v-model:selected-users="selectedUsers"
        class="flex-1 border-1 border-nc-border-gray-medium rounded-lg"
        :base-id="baseId"
        :permission-label="permissionLabel"
        :permission-description="permissionDescription"
        :permission="permission"
        :open="visible"
        list-class-name="!w-auto"
        show-search-always
        :disabled-users="selectedBelowMinimumRoleUsers"
      >
      </PermissionsUserSelectorList>

      <div class="flex items-center justify-between pt-4 border-t border-nc-border-gray-light">
        <div class="flex gap-4">
          <NcButton
            type="text"
            size="small"
            :disabled="isLoading || userSelectorListRef?.list?.length === 0"
            @click="userSelectorListRef?.selectAll()"
          >
            Select all
          </NcButton>
          <NcButton
            type="text"
            size="small"
            :disabled="isLoading || selectedUsers.size === 0"
            @click="userSelectorListRef?.clearAll()"
          >
            Clear all
          </NcButton>
        </div>

        <div class="flex gap-2">
          <NcButton type="secondary" size="small" :disabled="isLoading" @click="visible = false"> Cancel </NcButton>
          <NcButton
            type="primary"
            size="small"
            :loading="isLoading"
            :disabled="isLoading || selectedUsers.size === 0"
            @click="onSave"
          >
            Save
          </NcButton>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>
