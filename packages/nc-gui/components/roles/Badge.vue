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
</script>

<template>
  <NcTooltip
    :disabled="!showTooltip"
    class="flex items-start rounded-md w-[fit-content] nc-role-badge"
    :class="{
      'cursor-pointer': clickableRef,
    }"
  >
    <template #title>
      <slot name="tooltip" :label="roleProperties.label">
        {{ $t(`objects.roleType.${roleProperties.label}`) }}
      </slot>
    </template>

    <NcBadge
      class="!px-2 w-full"
      :class="[
        ncBadgeClass,
        {
          '!bg-gray-200 !border-gray-200 dark:!bg-gray-600 dark:!border-gray-600': isInheritRole,
        },
      ]"
      :color="roleProperties.color === 'disabled' ? 'gray' : roleProperties.color"
      :border="borderRef"
      :size="sizeSelect"
    >
      <div
        class="badge-text w-full flex items-center justify-between gap-2"
        :class="
          isInheritRole
            ? '!text-nc-content-gray-muted dark:!text-nc-content-gray-light'
            : roleColorsMapping[roleProperties.color]?.content ?? 'text-gray-300'
        "
      >
        <div class="flex items-center gap-2">
          <GeneralIcon
            v-if="showIcon"
            :icon="roleProperties.icon"
            :class="isInheritRole ? '!text-nc-content-gray-muted dark:!text-nc-content-gray-light' : ''"
          />
          <span v-if="!iconOnly" class="flex whitespace-nowrap">
            <slot name="label">
              {{ $t(`objects.roleType.${roleProperties.label}`) }}
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
