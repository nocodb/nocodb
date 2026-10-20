<script lang="ts" setup>
import type { UserType, WorkspaceUserType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    value: string[]
    users: WorkspaceUserType[]
    onChange: (userIds: string[]) => void
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const { value, users } = toRefs(props)

const { t } = useI18n()

const isDropdownOpen = ref(false)

const selectedUsers = computed(() => users.value.filter((user) => value.value.includes(user.fk_user_id!)))

function filterOption(input: string, option: NcListItemType) {
  return antSelectFilterOption(input, option, ['email', 'display_name'])
}
</script>

<template>
  <div class="nc-user-selector relative flex items-center w-full">
    <NcListDropdown
      v-model:is-open="isDropdownOpen"
      :disabled="disabled"
      default-slot-wrapper-class="w-full !h-auto min-h-8 !py-1"
      placement="bottomLeft"
    >
      <div class="w-[calc(100%_-_24px)] flex flex-wrap items-center gap-1">
        <div
          v-for="user of selectedUsers"
          :key="user.fk_user_id"
          class="flex items-center gap-1.5 border-1 border-nc-border-gray-medium rounded-xl pr-2 max-w-full"
        >
          <GeneralUserIcon :user="user as UserType" size="small" />
          <NcTooltip class="truncate" show-on-truncate-only>
            <template #title>{{ user.email }}</template>
            {{ extractUserDisplayNameOrEmail(user as UserType) }}
          </NcTooltip>
        </div>

        <span v-if="!selectedUsers.length" class="text-nc-content-gray-muted">
          {{ placeholder || t('labels.selectOneOrMoreMembers') }}
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
          :list="users"
          option-label-key="email"
          option-value-key="fk_user_id"
          :item-height="52"
          :search-input-placeholder="$t('title.searchMembers')"
          is-multi-select
          :close-on-select="false"
          :filter-option="filterOption"
          :empty-description="$t('labels.noUsersFound')"
          class="!w-auto min-w-80"
          variant="default"
          wrapper-class-name="!h-auto nc-user-selector-dropdown"
          @update:value="onChange($event as string[])"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ isSelected }">
            <NcCheckbox :checked="isSelected" />
          </template>

          <template #listItemContent="{ option }">
            <NcUserInfo :user="option as UserType" class="min-w-0 flex-1 overflow-hidden" />
          </template>

          <template #listItemSelectedIcon> <NcSpanHidden /> </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
