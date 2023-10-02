<script lang="ts" setup>
import { RoleDescriptions } from 'nocodb-sdk'
import type { RoleLabels } from 'nocodb-sdk'
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
const sizeRef = toRef(props, 'size')
</script>

<template>
  <NcDropdown size="lg" class="nc-roles-selector">
    <RolesBadge data-testid="roles" :role="roleRef" :inherit="inheritRef === role" clickable :size="sizeRef" />
    <template #overlay>
      <div class="nc-role-select-dropdown flex flex-col gap-1 p-2">
        <div class="flex flex-col gap-1">
          <div
            v-for="rl in props.roles"
            :key="rl"
            v-e="['c:workspace:settings:user-role-change']"
            :value="rl"
            :selected="rl === roleRef"
            @click="props.onRoleChange(rl)"
          >
            <div
              class="flex flex-col py-1.5 rounded-lg px-2 gap-1 bg-transparent cursor-pointer hover:bg-gray-100"
              :class="{
                'w-[350px]': descriptionRef,
                'w-[200px]': !descriptionRef,
              }"
            >
              <div class="flex items-center justify-between">
                <RolesBadge
                  class="!bg-white hover:!bg-gray-100"
                  :class="`nc-role-select-${rl}`"
                  :role="rl"
                  :inherit="inheritRef === rl"
                  :border="false"
                />
                <GeneralIcon v-if="rl === roleRef" icon="check" />
              </div>
              <div v-if="descriptionRef" class="text-gray-500">{{ RoleDescriptions[rl] }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss"></style>
