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
    triggerVariant?: 'badge' | 'compact' | 'detail' | 'field'
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
    triggerVariant: 'badge',
  },
)

const { role, inherit, showInherit, size, placement, description } = toRefs(props)

const { t } = useI18n()

const { getResponsiveValue } = useGlobal()

const isDropdownOpen = ref(false)

const newRole = ref<null | keyof typeof RoleLabels>(null)

async function onChangeRole(val: SelectValue) {
  if (val === role.value) return

  newRole.value = val as keyof typeof RoleLabels

  await props.onRoleChange(val as keyof typeof RoleLabels)

  newRole.value = null
}

const roleSelectorOptions = computed<NcListItemType[]>(() => {
  return (props.disabledRoles || []).concat(props.roles || []).map((role: keyof typeof RoleLabels): NcListItemType => {
    return {
      value: role,
      label: t(`objects.roleType.${RoleLabels[role] ?? role}`, role),
      description: t(`objects.roleDescription.${role}`),
      icon: RoleIcons[role],
      color: RoleColors[role],
      ncItemDisabled: props.disabledRoles?.includes(role),
      ncItemTooltip: props.disabledRoles?.includes(role) ? props.disabledRolesTooltip?.[role] ?? '' : '',
    }
  })
})

const activeRole = computed(() => {
  const key = (props.effectiveRole || props.role) as keyof typeof RoleLabels

  return {
    label: t(`objects.roleType.${RoleLabels[key] ?? key}`, key),
    description: t(`objects.roleDescription.${key}`),
    icon: RoleIcons[key] as IconMapKey,
    color: RoleColors[key],
  }
})
</script>

<template>
  <!-- The compact variant sits inside a sentence, so its wrapper has to stay
       inline or the pill breaks the line around it. -->
  <div
    class="nc-roles-selector relative"
    :class="triggerVariant === 'compact' ? 'inline-flex items-baseline align-middle' : 'flex items-center'"
  >
    <NcListDropdown
      v-model:visible="isDropdownOpen"
      :default-slot-wrapper="false"
      :default-slot-wrapper-class="triggerVariant === 'compact' ? 'inline-flex items-center' : 'flex-1 flex items-center gap-3'"
      :placement="placement"
    >
      <!-- The detail trigger carries the description at rest, so picking a role
           does not mean opening the menu to find out what it grants. -->
      <div
        v-if="triggerVariant === 'detail'"
        class="nc-role-trigger flex items-center gap-3 w-full p-1.5 rounded-lg cursor-pointer select-none"
        :class="{ 'is-open': isDropdownOpen }"
        data-testid="roles"
      >
        <div class="nc-role-trigger-tile flex-none h-11 w-11 rounded-xl flex items-center justify-center bg-nc-bg-gray-light">
          <!-- Neutral on purpose: the trigger shows the role you already picked,
               so the colour adds nothing and pulls the eye off the fields. Role
               colour still distinguishes the options inside the dropdown. -->
          <GeneralIcon :icon="activeRole.icon" class="h-5 w-5 text-nc-content-gray-subtle" />
        </div>

        <div class="flex flex-col min-w-0 gap-0.5">
          <div class="flex items-center gap-1">
            <span class="text-bodyDefault font-semibold text-nc-content-gray">{{ activeRole.label }}</span>
            <GeneralIcon
              icon="ncChevronDown"
              class="flex-none h-4 w-4 text-nc-content-gray-muted transition-transform duration-200"
              :class="{ '-rotate-180': isDropdownOpen }"
            />
          </div>
          <span class="text-bodySm text-nc-content-gray-muted truncate">{{ activeRole.description }}</span>
        </div>
      </div>

      <!-- Inline in a sentence, so it is shaped like the other inline token
           rather than a form control: a bordered box mid-prose reads as a field
           that escaped a form. The chevron and hover carry the affordance. -->
      <span
        v-else-if="triggerVariant === 'compact'"
        class="nc-role-trigger-compact"
        :class="{ 'is-open': isDropdownOpen }"
        data-testid="roles"
      >
        <span class="nc-role-trigger-compact-label">{{ activeRole.label }}</span>
        <GeneralIcon
          icon="ncChevronDown"
          class="nc-role-trigger-compact-caret"
          :class="{ '-rotate-180': isDropdownOpen }"
        />
      </span>

      <!-- The field trigger reads as a form control: the role and what it grants
           on one line, so picking one does not mean opening the menu to find out. -->
      <div
        v-else-if="triggerVariant === 'field'"
        class="nc-role-trigger-field flex items-center justify-between gap-2 w-full h-10 pl-3 pr-2.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default cursor-pointer select-none hover:bg-nc-bg-gray-extralight"
        data-testid="roles"
      >
        <span class="flex-1 min-w-0 truncate text-bodyDefault">
          <span class="font-medium text-nc-content-gray">{{ activeRole.label }}</span>
          <span class="text-nc-content-gray-muted"> · {{ activeRole.description }}</span>
        </span>
        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 text-nc-content-gray-subtle transition-transform duration-200"
          :class="{ '-rotate-180': isDropdownOpen }"
        />
      </div>

      <div v-else class="flex flex-col gap-1 cursor-pointer">
        <RolesBadge data-testid="roles" :border="false" :role="effectiveRole || role" :size="size" clickable class="flex-none" />
        <div
          v-if="showInherit && role === ProjectRoles.INHERIT && !!inherit"
          class="flex items-center gap-1 text-xs text-nc-content-gray-muted"
        >
          <GeneralIcon icon="role_inherit" class="h-3 w-3" />
          <span>{{
            inheritSource === 'team' ? $t('tooltip.roleInheritedFromTeam') : $t('tooltip.roleInheritedFromWorkspace')
          }}</span>
        </div>
      </div>

      <template #overlay="{ onEsc }">
        <!-- item-height must match the real pitch or scrollTo lands mid-row and
             clips the first one: 44px row + NcListItem's own my-[2px] = 46. -->
        <NcList
          v-model:open="isDropdownOpen"
          :value="role"
          :list="roleSelectorOptions"
          :item-height="!description ? 36 : 46"
          :min-items-for-search="8"
          class="!w-auto max-w-80"
          :class="{
            'min-w-50': !description,
            'min-w-80': description,
            'nc-role-list-expanded': description,
          }"
          :is-locked="!!newRole"
          variant="default"
          :focus-search-on-open="getResponsiveValue(false, true)"
          :item-class-name="`nc-role-select-dropdown !px-3 !py-1 ${description ? '!h-11' : ''}`"
          :wrapper-class-name="`!h-auto nc-role-selector-dropdown ${!!newRole ? '!cursor-wait' : ''}`"
          @update:value="onChangeRole"
          @escape="onEsc"
        >
          <template #listItem="{ option }">
            <NcTooltip class="w-full" :disabled="description || !option.description" placement="right" :arrow="false">
              <template #title>{{ option.description }}</template>
              <div class="w-full flex flex-col rounded-md" :class="[`nc-role-select-${option.value}`]">
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <!-- Monochrome on purpose: the row already names the role and
                         the tick marks the current one, so per-role hues only
                         added noise. Colour still lives on the badge/trigger. -->
                    <GeneralIcon :icon="(option.icon as IconMapKey)" class="flex-none h-4 w-4 text-nc-content-gray-muted" />
                    <span class="text-captionDropdownDefault text-nc-content-gray" :class="{ '!font-semibold': !description }">
                      {{ option.label }}
                    </span>
                  </div>
                  <GeneralLoader v-if="option.value === newRole" size="medium" />
                  <GeneralIcon v-else-if="!newRole && option.value === role" icon="check" class="nc-role-check flex-none" />
                </div>
                <div
                  v-if="description"
                  class="text-bodySm !font-light ml-6 leading-snug truncate"
                  :class="
                    option.value === ProjectRoles.INHERIT
                      ? 'text-nc-content-gray-muted dark:text-nc-content-gray-light'
                      : 'text-nc-content-gray-muted'
                  "
                >
                  {{ option.description }}
                </div>
              </div>
            </NcTooltip>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>

<style lang="scss" scoped>
// Same token treatment as the domain chip beside it: both are the variables in
// the sentence, so they should read as one kind of thing.
.nc-role-trigger-compact {
  @apply inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md align-middle cursor-pointer select-none;
  background: var(--nc-bg-coloured-purple);
  color: var(--nc-content-purple-dark);
  transition: filter 0.15s ease;

  &:hover,
  &.is-open {
    filter: brightness(0.96);
  }
}

.nc-role-trigger-compact-label {
  @apply font-normal;
}

.nc-role-trigger-compact-caret {
  @apply flex-none h-3.5 w-3.5;
  color: var(--nc-content-purple-dark);
  transition: transform 0.2s ease;
}
</style>

<style lang="scss" scoped>
// Bigger and heavier than the default 16px outline tick — at 4px stroke it wins
// against the grey hover fill, which otherwise looked more selected than the
// actual selection.
.nc-role-check {
  @apply h-5 w-5 text-nc-content-brand;
  stroke-width: 4;
}

.nc-role-trigger {
  @apply transition-colors duration-150;

  &:hover,
  &.is-open {
    @apply bg-nc-bg-gray-light;
  }

  .nc-role-trigger-tile {
    @apply transition-colors duration-150;
  }

  &:hover .nc-role-trigger-tile,
  &.is-open .nc-role-trigger-tile {
    @apply bg-nc-bg-gray-medium;
  }
}
</style>

<style lang="scss">
// The overlay is teleported to body, so these cannot be scoped.
.nc-role-list-expanded {
  // NcList caps every list at 247px, which is 1.5 rows short of the seven roles
  // and leaves the menu opening part-scrolled with the first row sliced. Lift
  // both caps together — the outer one sizes the panel, the inner one scrolls.
  .nc-list-wrapper > div,
  .nc-list {
    max-height: 372px !important;
  }
}

// ant sizes the overlay to the trigger, and the detail trigger spans the dialog,
// which left ~280px of empty panel beside a 320px list.
.ant-dropdown:has(.nc-role-list-expanded) {
  min-width: 0 !important;
}
</style>
