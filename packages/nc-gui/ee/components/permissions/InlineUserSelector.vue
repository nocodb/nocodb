<script lang="ts" setup>
import { type PermissionKey, PermissionMeta, PermissionRoleMap, PermissionRolePower } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'

const props = defineProps<{
  selectedUsers: Set<string>
  baseId: string
  permissionLabel: string
  permissionDescription?: string
  permission?: PermissionKey
  readonly?: boolean
}>()

const emits = defineEmits(['update:selectedUsers', 'save'])

const selectedUsers = useVModel(props, 'selectedUsers', emits)

const { $e } = useNuxtApp()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

// Dropdown state
const isDropdownOpen = ref(false)

const containerRef = ref<HTMLElement | null>(null)

const baseUsers = computed(() => {
  return basesUser.value.get(props.baseId) || []
})

// Selected users display
const selectedUsersList = computed(() => {
  return Array.from(selectedUsers.value)
    .map((userId) => baseUsers.value.find((user) => user.id === userId))
    .filter(Boolean)
})

const visibleUsers = ref<User[]>([])
const hiddenCount = ref(0)

async function calculateVisibleUsers() {
  await nextTick()

  const containerWidth = containerRef.value?.offsetWidth ? containerRef.value.offsetWidth - 100 : 0
  let usedWidth = 0
  let count = 0

  for (const selectedUser of selectedUsersList.value) {
    const tagWidth = Math.min(
      estimateTagWidth({
        text: selectedUser!.display_name?.trim() || extractNameFromEmail(selectedUser!.email),
        iconWidth: 20,
        paddingX: 16,
      }),
      selectedUsersList.value.length === 1 ? containerWidth : containerWidth / 2,
    )

    if (usedWidth + tagWidth <= containerWidth) {
      usedWidth += tagWidth + 10
      count++
    } else {
      break
    }
  }

  visibleUsers.value = selectedUsersList.value.slice(0, count)
  hiddenCount.value = selectedUsersList.value.length - count
}

// Handle save
const handleSave = async () => {
  const selectedUsersList = Array.from(selectedUsers.value)

  const users = selectedUsersList
    .map((userId) => {
      const user = baseUsers.value.find((user) => user.id === userId)
      if (!user) return null
      return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      }
    })
    .filter((user) => user !== null) as PermissionSelectorUser[]

  emits('save', {
    selectedUsers: users,
  })

  $e('a:permissions:users:save')
}

// Reset search and save when dropdown closes
watch(isDropdownOpen, (isOpen) => {
  if (!isOpen) {
    // Save changes when dropdown closes
    handleSave()
  }
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

onMounted(() => {
  window.addEventListener('resize', calculateVisibleUsers)
  calculateVisibleUsers()
})

watch(selectedUsersList, () => {
  calculateVisibleUsers()
})
</script>

<template>
  <div v-if="!readonly" class="relative flex items-center">
    <NcListDropdown v-model:visible="isDropdownOpen" default-slot-wrapper-class="flex-1">
      <div class="flex items-center gap-1.5 w-full">
        <!-- Selected user tags -->
        <div v-if="selectedUsers.size === 0" class="font-medium flex-1 text-gray-500 truncate">
          -no users selected- (Nobody {{ permissionDescription }})
        </div>
        <div v-else ref="containerRef" class="flex items-center flex-1 overflow-hidden">
          <!-- Show first few users as tags -->
          <a-tag
            v-for="user of visibleUsers"
            :key="user?.id"
            class="rounded-tag !pl-0"
            color="'#ccc'"
            :class="{
              'max-w-1/2': visibleUsers.length >= 1,
            }"
          >
            <span
              :style="{
                color: tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              }"
              class="flex items-stretch gap-2 text-small"
            >
              <div>
                <GeneralUserIcon
                  size="auto"
                  :user="user"
                  class="!text-[0.6rem] !h-[18px]"
                  :disabled="selectedBelowMinimumRoleUsers.includes(user?.id ?? '')"
                />
              </div>
              <NcTooltip class="truncate max-w-full !leading-5 !text-caption" show-on-truncate-only>
                <template #title>
                  {{ user?.display_name?.trim() || extractNameFromEmail(user?.email) }}
                </template>
                <span :class="{ '!opacity-50': selectedBelowMinimumRoleUsers.includes(user?.id ?? '') }">
                  {{ user?.display_name?.trim() || extractNameFromEmail(user?.email) }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
          <!-- Show +X more if there are additional users -->
          <div
            v-if="hiddenCount > 0"
            class="flex items-center gap-1 pr-2 py-0.5 !text-caption text-nc-content-gray-subtle2 truncate"
          >
            + {{ hiddenCount }} more
          </div>
        </div>

        <GeneralIcon
          icon="chevronDown"
          class="flex-none h-4 w-4 text-nc-content-gray-muted transition-transform"
          :class="{ 'transform rotate-180': isDropdownOpen }"
        />
      </div>

      <template #overlay="{ onEsc }">
        <PermissionsUserSelectorList
          v-model:selected-users="selectedUsers"
          :open="isDropdownOpen"
          :base-id="baseId"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="permission"
          list-class-name="!w-auto"
          show-list-footer
          :readonly="readonly"
          :close-on-select="false"
          :disabled-users="selectedBelowMinimumRoleUsers"
          @escape="onEsc"
        >
        </PermissionsUserSelectorList>
      </template>
    </NcListDropdown>
  </div>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply bg-gray-200 px-2 rounded-[12px];
}
</style>
