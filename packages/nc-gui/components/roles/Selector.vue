<script lang="ts" setup>
import type { RoleLabels } from 'nocodb-sdk'
import { RoleDescriptions } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    roles: (keyof typeof RoleLabels)[]
    disabledRoles?: (keyof typeof RoleLabels)[]
    onRoleChange: (role: keyof typeof RoleLabels) => void
    border?: boolean
    description?: boolean
    inherit?: string
    size?: 'sm' | 'md' | 'lg'
    showInherit?: boolean
  }>(),
  {
    border: true,
    description: true,
    size: 'sm',
    showInherit: false,
  },
)

const roleRef = toRef(props, 'role')
const inheritRef = toRef(props, 'inherit')
const showInherit = toRef(props, 'showInherit')
const descriptionRef = toRef(props, 'description')
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)
const sizeRef = toRef(props, 'size')

onClickOutside(dropdownRef, () => (isDropdownOpen.value = false))

function onChangeRole(val: SelectValue) {
  props.onRoleChange(val as keyof typeof RoleLabels)
  isDropdownOpen.value = false
}
</script>

<template>
  <div
    ref="dropdownRef"
    size="lg"
    class="nc-roles-selector relative flex items-center gap-3"
    @click="isDropdownOpen = !isDropdownOpen"
  >
    <RolesBadge
      :border="false"
      :inherit="inheritRef === role"
      :role="roleRef"
      :size="sizeRef"
      clickable
      data-testid="roles"
      class="flex-none"
    />
    <NcTooltip
      v-if="showInherit && isEeUI && inheritRef === role"
      class="uppercase text-[10px] leading-4 text-gray-500"
      placement="bottom"
    >
      <template #title>
        {{ $t('tooltip.roleInheritedFromWorkspace') }}
      </template>
      {{ $t('objects.workspace') }}
    </NcTooltip>

    <a-select
      :value="roleRef"
      :open="isDropdownOpen"
      :dropdown-match-select-width="false"
      dropdown-class-name="!rounded-lg !h-fit max-w-[350px] nc-role-selector-dropdown"
      class="py-1 !absolute top-0 left-0 w-20 h-full z-10 text-xs opacity-0"
      @change="onChangeRole"
    >
      <a-select-option v-for="rl in props.disabledRoles || []" :key="rl" :value="rl" disabled>
        <div
          :class="{
            'w-full': descriptionRef,
            'w-[200px]': !descriptionRef,
          }"
          class="flex flex-col nc-role-select-dropdown gap-1"
        >
          <div class="flex items-center justify-between">
            <RolesBadge disabled :border="false" :inherit="inheritRef === rl" :role="rl" />
            <GeneralIcon v-if="rl === roleRef" icon="check" class="text-primary" />
          </div>
          <div v-if="descriptionRef" class="text-gray-500 text-xs">{{ RoleDescriptions[rl] }}</div>
        </div>
      </a-select-option>
      <a-select-option v-for="rl in props.roles" :key="rl" v-e="['c:workspace:settings:user-role-change']" :value="rl">
        <div
          :class="{
            'w-full': descriptionRef,
            'w-[200px]': !descriptionRef,
          }"
          class="flex flex-col nc-role-select-dropdown gap-1"
        >
          <div class="flex items-center justify-between">
            <RolesBadge :border="false" :class="`nc-role-select-${rl}`" :inherit="inheritRef === rl" :role="rl" />
            <GeneralIcon v-if="rl === roleRef" icon="check" class="text-primary" />
          </div>
          <div v-if="descriptionRef" class="text-gray-500 text-xs">{{ RoleDescriptions[rl] }}</div>
        </div>
      </a-select-option>
    </a-select>
  </div>
</template>

<style lang="scss">
.ant-select-item-option-content {
  white-space: normal; /* Change from 'nowrap' to 'normal' */
}
.nc-role-selector-dropdown {
  .rc-virtual-list-holder {
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-track-piece {
      width: 0px;
    }
    &::-webkit-scrollbar {
      @apply bg-transparent;
    }
    &::-webkit-scrollbar-thumb {
      width: 4px;
      @apply bg-gray-200 rounded-md;
    }
    &::-webkit-scrollbar-thumb:hover {
      @apply bg-gray-300;
    }
  }
}
</style>
