<script lang="ts" setup>
import { RoleColors, RoleIcons, RoleLabels } from 'nocodb-sdk'
import { toRef } from '#imports'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    clickable?: boolean
    inherit?: boolean
    border?: boolean
    size?: 'sm' | 'md'
  }>(),
  {
    clickable: false,
    inherit: false,
    border: true,
    size: 'sm',
  },
)

const roleRef = toRef(props, 'role')
const clickableRef = toRef(props, 'clickable')
const borderRef = toRef(props, 'border')

const sizeSelect = computed(() => props.size)

const roleProperties = computed(() => {
  const role = roleRef.value

  const color = RoleColors[role]
  const icon = RoleIcons[role]
  const label = RoleLabels[role]

  return {
    color,
    icon,
    label,
  }
})
</script>

<template>
  <div
    class="flex items-start rounded-md"
    :class="{
      'cursor-pointer': clickableRef,
    }"
  >
    <NcBadge class="!px-2" :color="roleProperties.color" :border="borderRef" :size="sizeSelect">
      <div
        class="badge-text flex items-center gap-2"
        :class="{
          'text-purple-500': roleProperties.color === 'purple',
          'text-blue-500': roleProperties.color === 'blue',
          'text-green-500': roleProperties.color === 'green',
          'text-orange-500': roleProperties.color === 'orange',
          'text-yellow-500': roleProperties.color === 'yellow',
          'text-red-500': roleProperties.color === 'red',
          'text-gray-300': !roleProperties.color,
          sizeSelect,
        }"
      >
        <GeneralIcon :icon="roleProperties.icon" />
        {{ roleProperties.label }}
        <GeneralIcon v-if="clickableRef" icon="arrowDown" />
      </div>
    </NcBadge>
    <div class="flex-1"></div>
    <!--
    <a-tooltip v-if="inheritRef" placement="bottom">
      <div class="text-gray-400 text-xs p-1 rounded-md">Workspace Role</div>
    </a-tooltip>
    -->
  </div>
</template>

<style scoped lang="scss"></style>
