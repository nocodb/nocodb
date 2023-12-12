<script lang="ts" setup>
import { RoleDescriptions } from 'nocodb-sdk'
import type { RoleLabels } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'
import { toRef } from '#imports'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    roles: (keyof typeof RoleLabels)[]
    description?: boolean
    inherit?: string
    onRoleChange: (role: keyof typeof RoleLabels) => void
    size: 'sm' | 'md'
  }>(),
  {
    description: true,
    size: 'sm',
  },
)

const roleRef = toRef(props, 'role')
const inheritRef = toRef(props, 'inherit')
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
  <div ref="dropdownRef" size="lg" class="nc-roles-selector relative" @click="isDropdownOpen = !isDropdownOpen">
    <RolesBadge data-testid="roles" :role="roleRef" :inherit="inheritRef === role" :size="sizeRef" />
    <a-select
      v-model:value="roleRef"
      :open="isDropdownOpen"
      :dropdown-match-select-width="false"
      dropdown-class-name="!rounded-lg  !h-fit max-w-64"
      class="py-1 !absolute top-0 left-0 w-full h-full z-10 text-xs opacity-0"
      @change="onChangeRole"
    >
      <a-select-option v-for="rl in props.roles" :key="rl" v-e="['c:workspace:settings:user-role-change']" :value="rl">
        <div
          :class="{
            'w-[350px]': descriptionRef,
            'w-[200px]': !descriptionRef,
          }"
          class="flex flex-col nc-role-select-dropdown gap-1"
        >
          <div class="flex items-center justify-between">
            <RolesBadge :class="`nc-role-select-${rl}`" :role="rl" :inherit="inheritRef === rl" :border="false" />
            <GeneralIcon v-if="rl === roleRef" icon="check" class="text-primary" />
          </div>
          <div v-if="descriptionRef" class="text-gray-500">{{ RoleDescriptions[rl] }}</div>
        </div>
      </a-select-option>
    </a-select>
  </div>
</template>

<style lang="scss">
.ant-select-item-option-content {
  white-space: normal; /* Change from 'nowrap' to 'normal' */
}
</style>
