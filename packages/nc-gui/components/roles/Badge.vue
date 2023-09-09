<script lang="ts" setup>
import { RoleColors, RoleDescriptions, RoleIcons, RoleLabels } from 'nocodb-sdk'
import { toRef } from '#imports'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    description?: boolean
    clickable?: boolean
    inherit?: boolean
  }>(),
  {
    description: true,
    clickable: false,
    inherit: false,
  },
)

const roleRef = toRef(props, 'role')
const descriptionRef = toRef(props, 'description')
const clickableRef = toRef(props, 'clickable')
const inheritRef = toRef(props, 'inherit')

const roleProperties = computed(() => {
  const role = roleRef.value

  const color = RoleColors[role]
  const icon = RoleIcons[role]
  const label = RoleLabels[role]
  const descriptionText = RoleDescriptions[role]

  return {
    color,
    icon,
    label,
    descriptionText,
  }
})
</script>

<template>
  <div
    class="flex flex-col py-[6px] px-[8px] gap-[4px] w-[350px] rounded-md bg-gray-50"
    :class="{
      'cursor-pointer hover:bg-gray-100': clickableRef,
    }"
  >
    <div class="flex items-center">
      <NcBadge class="!h-auto !px-[8px]" :color="roleProperties.color">
        <div
          class="badge-text flex items-center gap-[4px]"
          :class="{
            'text-purple-500': roleProperties.color === 'purple',
            'text-blue-500': roleProperties.color === 'blue',
            'text-green-500': roleProperties.color === 'green',
            'text-orange-500': roleProperties.color === 'orange',
            'text-yellow-500': roleProperties.color === 'yellow',
            'text-red-500': roleProperties.color === 'red',
            'text-gray-300': !roleProperties.color,
          }"
        >
          <GeneralIcon :icon="roleProperties.icon" />
          {{ roleProperties.label }}
        </div>
      </NcBadge>
      <div class="flex-1"></div>
      <a-tooltip v-if="inheritRef" placement="bottom">
        <div class="text-gray-400 text-xs p-1 rounded-md">Current Workspace Role</div>
      </a-tooltip>
    </div>
    <div v-if="descriptionRef" class="text-gray-500">{{ roleProperties.descriptionText }}</div>
  </div>
</template>

<style scoped lang="scss"></style>
