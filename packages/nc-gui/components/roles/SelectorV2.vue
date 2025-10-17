<script lang="ts" setup>
import { RoleColors, RoleIcons, RoleLabels } from 'nocodb-sdk'
import type { SelectValue } from 'ant-design-vue/es/select'
import type { IconMapKey } from '#imports'

const props = withDefaults(
  defineProps<{
    role: keyof typeof RoleLabels
    roles: (keyof typeof RoleLabels)[]
    disabledRoles?: (keyof typeof RoleLabels)[]
    onRoleChange: (role: keyof typeof RoleLabels) => void | Promise<any>
    border?: boolean
    description?: boolean
    inherit?: string
    size?: 'sm' | 'md' | 'lg'
    showInherit?: boolean
    placement?: 'bottomRight' | 'bottomLeft'
  }>(),
  {
    border: true,
    description: true,
    size: 'sm',
    showInherit: false,
    placement: 'bottomLeft',
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
    (role: keyof typeof RoleLabels): NcListItemType => ({
      value: role,
      label: t(`objects.roleType.${RoleLabels[role]}`),
      description: t(`objects.roleDescription.${role}`),
      icon: RoleIcons[role],
      color: RoleColors[role],
      ncItemDisabled: props.disabledRoles?.includes(role),
    }),
  )
})
</script>

<template>
  <div class="nc-roles-selector relative flex items-center">
    <NcListDropdown
      v-model:visible="isDropdownOpen"
      :default-slot-wrapper="false"
      default-slot-wrapper-class="flex-1 flex items-center gap-3"
      :placement="placement"
    >
      <RolesBadge
        :border="false"
        :inherit="inherit === role"
        :role="role"
        :size="size"
        clickable
        data-testid="roles"
        class="flex-none"
      />
      <NcTooltip
        v-if="showInherit && isEeUI && inherit === role"
        class="uppercase text-[10px] leading-4 text-nc-content-gray-muted"
        placement="bottom"
        :disabled="isDropdownOpen"
      >
        <template #title>
          {{ $t('tooltip.roleInheritedFromWorkspace') }}
        </template>
        {{ $t('objects.workspace') }}
      </NcTooltip>

      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isDropdownOpen"
          :value="role"
          :list="roleSelectorOptions"
          :item-height="48"
          class="!w-auto max-w-80"
          :class="{
            'min-w-50': !description,
            'min-w-80': description,
          }"
          :isLocked="!!newRole"
          variant="default"
          item-class-name="nc-role-select-dropdown"
          :wrapper-class-name="`!h-auto nc-role-selector-dropdown ${!!newRole ? '!cursor-wait' : ''}`"
          @update:value="onChangeRole"
          @escape="onEsc"
        >
          <template #listItem="{ option }">
            <div class="w-full flex flex-col" :class="`nc-role-select-${option.value}`">
              <div class="w-full flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <GeneralIcon
                    :icon="(option.icon as IconMapKey)"
                    class="flex-none h-4 w-4"
                    :class="roleColorsMapping[option.color]?.content ?? 'text-gray-300'"
                  />
                  <span
                    class="text-captionDropdownDefault"
                    :class="[
                      roleColorsMapping[option.color]?.content ?? 'text-gray-300',
                      {
                        '!font-semibold': !description,
                      },
                    ]"
                  >
                    {{ option.label }}
                  </span>
                </div>
                <GeneralLoader v-if="option.value === newRole" size="medium" />
                <GeneralIcon v-else-if="!newRole && option.value === role" icon="check" class="text-primary h-4 w-4" />
              </div>
              <div v-if="description" class="text-bodySm !font-light text-nc-content-gray-muted ml-6">
                {{ option.description }}
              </div>
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
