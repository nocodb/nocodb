<script lang="ts" setup>
import type { RoleLabels } from 'nocodb-sdk'
import { toRef } from '#imports'

const props = defineProps<{
  role: keyof typeof RoleLabels
  roles: (keyof typeof RoleLabels)[]
  inherit?: string
  onRoleChange: (role: keyof typeof RoleLabels) => void
}>()

const roleRef = toRef(props, 'role')
const inheritRef = toRef(props, 'inherit')
</script>

<template>
  <NcDropdown>
    <RolesBadge class="border-1" :role="roleRef" clickable :inherit="inheritRef === role" />
    <template #overlay>
      <div class="nc-role-select-dropdown flex flex-col gap-[4px] p-1">
        <div class="flex flex-col gap-[4px]">
          <div
            v-for="rl in props.roles"
            :key="rl"
            class="cursor-pointer"
            :value="rl"
            :selected="rl === roleRef"
            @click="props.onRoleChange(rl)"
          >
            <RolesBadge
              class="!bg-white hover:!bg-gray-100"
              :class="`nc-role-select-${rl}`"
              :role="rl"
              :inherit="inheritRef === rl"
            />
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss"></style>
