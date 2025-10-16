<script lang="ts" setup>
import { RoleColors, RoleIcons, RoleLabels } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    clickable?: boolean
    inherit?: boolean
    border?: boolean
    showIcon?: boolean
    iconOnly?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg'
    disabled?: boolean
    ncBadgeClass?: string
    showTooltip?: boolean
  }>(),
  {
    clickable: false,
    inherit: false,
    border: true,
    size: 'sm',
    iconOnly: false,
    showIcon: true,
    ncBadgeClass: '',
    showTooltip: false,
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
    color: props.disabled ? 'gray' : color,
    icon,
    label,
  }
})
</script>

<template>
  <NcTooltip
    :disabled="!showTooltip"
    class="flex items-start rounded-md w-[fit-content] nc-role-badge"
    :class="{
      'cursor-pointer': clickableRef,
    }"
  >
    <template #title> {{ $t(`objects.roleType.${roleProperties.label}`) }}</template>

    <NcBadge class="!px-2 w-full" :class="ncBadgeClass" :color="roleProperties.color" :border="borderRef" :size="sizeSelect">
      <div
        class="badge-text w-full flex items-center justify-between gap-2"
        :class="roleColorsMapping[roleProperties.color]?.content ?? 'text-gray-300'"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon v-if="showIcon" :icon="roleProperties.icon" />
          <span v-if="!iconOnly" class="flex whitespace-nowrap">
            {{ $t(`objects.roleType.${roleProperties.label}`) }}
          </span>
        </div>
        <GeneralIcon v-if="clickableRef" icon="arrowDown" class="flex-none" />
      </div>
    </NcBadge>

    <!--
    <a-tooltip v-if="inheritRef" placement="bottom">
      <div class="text-gray-400 text-xs p-1 rounded-md">Workspace Role</div>
    </a-tooltip>
    -->
  </NcTooltip>
</template>
