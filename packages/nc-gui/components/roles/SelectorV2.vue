<script lang="ts" setup>
import { ProjectRoles, RoleColors, RoleIcons, RoleLabels } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'
import type { IconMapKey } from '#imports'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    roles: (keyof typeof RoleLabels)[]
    disabledRoles?: (keyof typeof RoleLabels)[]
    disabledRolesTooltip?: Record<keyof typeof RoleLabels, string>
    onRoleChange: (role: keyof typeof RoleLabels) => void | Promise<any>
    border?: boolean
    description?: boolean
    inherit?: string
    size?: 'sm' | 'md' | 'lg'
    showInherit?: boolean
    placement?: 'bottomRight' | 'bottomLeft'
    inheritedRoleIcon?: string
    inheritSource?: 'workspace' | 'team'
    effectiveRole?: string
  }>(),
  {
    border: true,
    description: true,
    size: 'sm',
    showInherit: false,
    placement: 'bottomLeft',
    inheritedRoleIcon: undefined,
    inheritSource: undefined,
    effectiveRole: undefined,
  },
)

const { role, inherit, showInherit, size, placement, description } = toRefs(props)

const { t } = useI18n()

const isDropdownOpen = ref(false)

const newRole = ref<null | keyof typeof RoleLabels>(null)

async function onChangeRole(val: SelectValue) {
  if (val === role.value) return

  newRole.value = val as keyof typeof RoleLabels

  await props.onRoleChange(val as keyof typeof RoleLabels)

  newRole.value = null
}

const roleSelectorOptions = computed<NcListItemType[]>(() => {
  return (props.disabledRoles || []).concat(props.roles || []).map(
    (role: keyof typeof RoleLabels): NcListItemType => {
      // For inherit roles, show enhanced description with effective role
      const isInheritRole = role === ProjectRoles.INHERIT
      const enhancedDescription = isInheritRole && props.effectiveRole
        ? `${t(`objects.roleDescription.${role}`)} • ${t('tooltip.effectiveRole', { role: t(`objects.roleType.${props.effectiveRole}`) })}`
        : t(`objects.roleDescription.${role}`)
      
      return {
        value: role,
        label: t(`objects.roleType.${RoleLabels[role]}`),
        description: enhancedDescription,
        icon: RoleIcons[role],
        color: RoleColors[role],
        ncItemDisabled: props.disabledRoles?.includes(role),
        ncItemTooltip: props.disabledRoles?.includes(role) ? props.disabledRolesTooltip?.[role] ?? '' : '',
      }
    }
  )
})

// Helper computed for template access to RoleIcons and RoleColors
const roleIconsRef = computed(() => RoleIcons)
const roleColorsRef = computed(() => RoleColors)
</script>

<template>
  <div class="nc-roles-selector relative flex items-center">
    <NcListDropdown
      v-model:visible="isDropdownOpen"
      :default-slot-wrapper="false"
      default-slot-wrapper-class="flex-1 flex items-center gap-3"
      :placement="placement"
    >
      <!-- Double-line display for inherit roles -->
      <div 
        v-if="showInherit && isEeUI && role === ProjectRoles.INHERIT && effectiveRole"
        class="flex flex-col gap-1 cursor-pointer"
        data-testid="roles"
      >
        <RolesBadge
          :border="false"
          :role="effectiveRole"
          :size="size"
          clickable
          class="flex-none"
        />
        <div class="flex items-center gap-1 text-xs text-nc-content-gray-muted">
          <GeneralIcon icon="ncInherit" class="h-3 w-3" />
          <span>{{ inheritSource === 'team' ? $t('tooltip.roleInheritedFromTeam') : $t('tooltip.roleInheritedFromWorkspace') }}</span>
        </div>
      </div>
      <!-- Single-line display for non-inherit roles -->
      <RolesBadge
        v-else
        :border="false"
        :inherit="!!inherit && role === ProjectRoles.INHERIT"
        :role="role"
        :size="size"
        clickable
        data-testid="roles"
        class="flex-none"
      />

      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isDropdownOpen"
          :value="role"
          :list="roleSelectorOptions"
          :item-height="!description ? 48 : 72"
          class="!w-auto max-w-80"
          :class="{
            'min-w-50': !description,
            'min-w-80': description,
          }"
          :is-locked="!!newRole"
          variant="default"
          item-class-name="nc-role-select-dropdown !px-3"
          :wrapper-class-name="`!h-auto nc-role-selector-dropdown ${!!newRole ? '!cursor-wait' : ''}`"
          @update:value="onChangeRole"
          @escape="onEsc"
        >
          <template #listItem="{ option }">
            <div class="w-full flex flex-col rounded-md" :class="[`nc-role-select-${option.value}`]">
              <!-- Special handling for inherit roles -->
              <div v-if="option.value === ProjectRoles.INHERIT && effectiveRole" class="w-full flex flex-col gap-2">
                <!-- Main role display -->
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <GeneralIcon
                      :icon="roleIconsRef[effectiveRole] as IconMapKey"
                      class="flex-none h-4 w-4"
                      :class="roleColorsMapping[roleColorsRef[effectiveRole]]?.content ?? 'text-nc-content-brand-hover'"
                    />
                    <span
                      class="text-captionDropdownDefault"
                      :class="[
                        roleColorsMapping[roleColorsRef[effectiveRole]]?.content ?? 'text-nc-content-brand-hover',
                        {
                          '!font-semibold': !description,
                        },
                      ]"
                    >
                      {{ t(`objects.roleType.${effectiveRole}`) }}
                    </span>
                  </div>
                  <GeneralLoader v-if="option.value === newRole" size="medium" />
                  <GeneralIcon v-else-if="!newRole && option.value === role" icon="check" class="text-nc-content-brand h-4 w-4" />
                </div>
                <!-- Inherit source information -->
                <div class="flex items-center gap-2 ml-6">
                  <GeneralIcon icon="link2" class="h-3 w-3 text-nc-content-gray-muted" />
                  <span class="text-xs text-nc-content-gray-muted">
                    {{ inheritSource === 'team' ? $t('tooltip.roleInheritedFromTeam') : $t('tooltip.roleInheritedFromWorkspace') }}
                  </span>
                </div>
                <!-- Description -->
                <div
                  v-if="description"
                  class="text-bodySm !font-light ml-6 text-nc-content-gray-muted dark:text-nc-content-gray-light"
                >
                  {{ option.description }}
                </div>
              </div>
              
              <!-- Standard role display -->
              <div v-else class="w-full flex flex-col">
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <GeneralIcon
                      :icon="(option.icon as IconMapKey)"
                      class="flex-none h-4 w-4"
                      :class="roleColorsMapping[option.color]?.content ?? 'text-nc-content-brand-hover'"
                    />
                    <span
                      class="text-captionDropdownDefault"
                      :class="[
                        roleColorsMapping[option.color]?.content ?? 'text-nc-content-brand-hover',
                        {
                          '!font-semibold': !description,
                        },
                      ]"
                    >
                      {{ option.label }}
                    </span>
                  </div>
                  <GeneralLoader v-if="option.value === newRole" size="medium" />
                  <GeneralIcon v-else-if="!newRole && option.value === role" icon="check" class="text-nc-content-brand h-4 w-4" />
                </div>
                <div
                  v-if="description"
                  class="text-bodySm !font-light ml-6"
                  :class="
                    option.value === ProjectRoles.INHERIT
                      ? 'text-nc-content-gray-muted dark:text-nc-content-gray-light'
                      : 'text-nc-content-gray-muted'
                  "
                >
                  {{ option.description }}
                </div>
              </div>
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
