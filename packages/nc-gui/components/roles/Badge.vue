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
          'text-purple-700': roleProperties.color === 'purple',
          'text-blue-700': roleProperties.color === 'blue',
          'text-green-700': roleProperties.color === 'green',
          'text-orange-700': roleProperties.color === 'orange',
          'text-yellow-700': roleProperties.color === 'yellow',
          'text-red-700': roleProperties.color === 'red',
          'text-maroon-700': roleProperties.color === 'maroon',
          'text-gray-300': !roleProperties.color,
          sizeSelect,
        }"
      >
        <GeneralIcon :icon="roleProperties.icon" />
        <span class="flex whitespace-nowrap">
          {{ $t(`objects.roleType.${roleProperties.label}`) }}
        </span>
        <GeneralIcon v-if="clickableRef" icon="arrowDown" />
      </div>
    </NcBadge>
    <!--
    <a-tooltip v-if="inheritRef" placement="bottom">
      <div class="text-gray-400 text-xs p-1 rounded-md">Workspace Role</div>
    </a-tooltip>
    -->
  </div>
</template>

<style scoped lang="scss"></style>
