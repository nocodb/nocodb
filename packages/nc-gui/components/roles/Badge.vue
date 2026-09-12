<script lang="ts" setup>
import { ProjectRoles, RoleColors, RoleIcons, RoleLabels, WorkspaceUserRoles } from 'nocodb-sdk'

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
    inheritedRoleIcon?: string
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
    inheritedRoleIcon: undefined,
  },
)

const { t } = useI18n()

const roleRef = toRef(props, 'role')
const clickableRef = toRef(props, 'clickable')
const borderRef = toRef(props, 'border')

const sizeSelect = computed(() => props.size)

const isInheritRole = computed(() => {
  const role = roleRef.value
  return role === 'inherit' || role === ProjectRoles.INHERIT || role === WorkspaceUserRoles.INHERIT
})

const roleProperties = computed(() => {
  const role = roleRef.value
  const color = RoleColors[role]
  // Use inherited role icon if role is INHERIT and inheritedRoleIcon is provided
  const icon = isInheritRole.value && props.inheritedRoleIcon ? props.inheritedRoleIcon : RoleIcons[role]
  const label = RoleLabels[role]

  return {
    color: props.disabled ? 'disabled' : color,
    icon,
    label,
  }
})

// Roles outside RoleLabels fall back to the raw value instead of rendering the key path.
const roleLabel = computed(() => {
  const key = roleProperties.value.label ?? roleRef.value
  return key ? t(`objects.roleType.${key}`, key) : ''
})
</script>

<template>
  <NcTooltip
    v-if="role"
    :disabled="!showTooltip"
    class="flex items-start rounded-md w-[fit-content] nc-role-badge"
    :class="{
      'cursor-pointer': clickableRef,
    }"
  >
    <template #title>
      <slot name="tooltip" :label="roleLabel">
        {{ roleLabel }}
      </slot>
    </template>

    <NcBadge
      class="!px-2 w-full"
      :class="[ncBadgeClass, roleColorsMapping[roleProperties.color]?.badgeClass ?? '']"
      :color="roleProperties.color === 'disabled' ? 'gray' : roleProperties.color"
      :border="borderRef"
      :size="sizeSelect"
    >
      <div
        class="badge-text w-full flex items-center justify-between gap-2"
        :class="
          roleColorsMapping[roleProperties.color]?.badgeContent ??
          roleColorsMapping[roleProperties.color]?.content ??
          'text-nc-content-brand-hover'
        "
      >
        <div class="flex items-center gap-2">
          <GeneralIcon v-if="showIcon" :icon="roleProperties.icon" />
          <span v-if="!iconOnly" class="flex whitespace-nowrap">
            <slot name="label">
              {{ roleLabel }}
            </slot>
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
