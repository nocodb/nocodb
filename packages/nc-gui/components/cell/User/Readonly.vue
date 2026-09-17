<script lang="ts" setup>
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from 'ant-design-vue'
import { CURRENT_USER_TOKEN, type UserFieldRecordType } from 'nocodb-sdk'
import { extractUserKeys, getOptions, getSelectedUsers, getSystemUserFilterOptions } from './utils'

interface Props {
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null
  rowIndex?: number
  location?: 'cell' | 'filter'
  forceMulti?: boolean
  options?: UserFieldRecordType[]
}

const { modelValue, forceMulti, options: userOptions } = defineProps<Props>()

const { t } = useI18n()

const { getColor } = useTheme()

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const isInFilter = inject(IsInFilterInj, ref(false))

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const idUserMap = computed(() => {
  return baseUsers.value.reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

const { resolvedUsers, resolveUsers } = useResolveUsers()

// User keys (ids/emails) referenced by this cell that are NOT base collaborators
// — i.e. external submitters that need resolving for display.
const unresolvedKeys = computed(() => extractUserKeys(modelValue).filter((key) => !idUserMap.value[key]))

watch(
  [unresolvedKeys, () => meta.value?.base_id, () => meta.value?.id],
  ([keys, baseId, tableId]) => {
    if (keys.length && baseId && tableId) resolveUsers(baseId, tableId, keys)
  },
  { immediate: true },
)

// Resolved external submitters for this cell, shaped as user-field options.
const resolvedOptions = computed<UserFieldRecordType[]>(() =>
  unresolvedKeys.value
    .map((key) => resolvedUsers.value.get(key))
    .filter((u): u is UserFieldRecordType => !!u)
    .map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      meta: u.meta,
      deleted: false,
    })),
)

const isForm = inject(IsFormInj, ref(false))

const isMultiple = computed(() => forceMulti || (column.value.meta as { is_multi: boolean; notify: boolean })?.is_multi)

const rowHeight = inject(RowHeightInj, ref(isInFilter.value ? 1 : undefined))

const isKanban = inject(IsKanbanInj, ref(false))

const extensionConfig = inject(ExtensionConfigInj, ref({ isPageDesignerPreviewPanel: false }))

const isPageDesignerPreviewPanel = computed(() => {
  return extensionConfig.value.isPageDesignerPreviewPanel
})

const options = computed(() => {
  const currentUserField: any[] = []
  if (isEeUI && isInFilter.value) {
    currentUserField.push({
      id: CURRENT_USER_TOKEN,
      display_name: t('title.currentUser'),
      email: CURRENT_USER_TOKEN,
    })
  }

  const systemUsers = isInFilter.value ? getSystemUserFilterOptions(column.value) : []

  return [
    ...currentUserField,
    ...(userOptions ?? getOptions(column.value, false, isForm.value, baseUsers.value)),
    ...resolvedOptions.value,
    ...systemUsers,
  ]
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.id) {
      acc[op.id] = op
    }
    if (op.email) {
      acc[op.email.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const selectedUsers = computed(() => getSelectedUsers(optionsMap.value, modelValue))

const selectedUsersListLayout = computed(() => {
  if (isMultiple.value) {
    return (selectedUsers.value || []).map((item) => item.value)
  } else {
    return (selectedUsers.value || [])?.[0]?.value || ''
  }
})

// check if user is part of the base
const isCollaborator = (userIdOrEmail) => {
  // The current-user token (filter UI) is always treated as a collaborator.
  if (userIdOrEmail === CURRENT_USER_TOKEN) return true

  const baseUser = idUserMap.value?.[userIdOrEmail]

  // Not in the base collaborator list — either a deleted user or an external
  // submitter resolved for display only. Render with the "no base access" look.
  if (!baseUser) return false

  return !baseUser.deleted
}
</script>

<template>
  <div class="nc-cell-field nc-user-select h-full w-full flex items-center read-only">
    <div v-if="isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <component
        :is="isMultiple ? CheckboxGroup : RadioGroup"
        :value="selectedUsersListLayout"
        class="nc-field-layout-list"
        disabled
      >
        <template v-for="op of options" :key="op.id || op.email">
          <component
            :is="isMultiple ? Checkbox : Radio"
            v-if="!op.deleted"
            :key="op.id || op.email"
            :class="`nc-select-option-${column.title}-${op.email}`"
            :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
            :value="op.id"
          >
            <a-tag class="rounded-tag max-w-full !pl-0" color="'#ccc'">
              <span
                :style="{
                  color: getSelectTypeOptionTextColor('#ccc', getColor),
                }"
                class="flex items-stretch gap-2 text-small"
              >
                <div>
                  <GeneralUserIcon :disabled="!isCollaborator(op.id)" :user="op" class="!text-[0.5rem] !h-[16.8px]" size="auto" />
                </div>
                <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ extractUserDisplayNameOrEmail(op) }}
                  </template>
                  <span
                    :class="{
                      'text-nc-content-gray-subtle2': !isCollaborator(op.id || op.email),
                    }"
                    :style="{
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                      display: 'inline',
                    }"
                    class="text-ellipsis overflow-hidden"
                  >
                    {{ extractUserDisplayNameOrEmail(op) }}
                  </span>
                </NcTooltip>
              </span>
            </a-tag>
          </component>
        </template>
      </component>
    </div>

    <div
      v-else
      class="flex overflow-hidden"
      :class="{
        'gap-y-1': !isPageDesignerPreviewPanel,
        'flex-wrap flex-col items-start gap-2': extensionConfig?.widget?.displayAs === 'List',
      }"
      :style="
        extensionConfig?.widget?.displayAs !== 'List'
          ? {
              'flex-wrap': !isInFilter,
              'max-width': '100%',
              '-webkit-line-clamp': rowHeightTruncateLines(rowHeight, true),
              'maxHeight': `${rowHeightInPx[rowHeight] - 12}px`,
            }
          : {}
      "
    >
      <template v-for="selectedOpt of selectedUsers" :key="selectedOpt.value">
        <a-tag
          :class="{
            '!my-0': !rowHeight || rowHeight === 1,
          }"
          class="rounded-tag max-w-full !pl-0"
          :color="
            selectedOpt.value === CURRENT_USER_TOKEN
              ? themeV4Colors.brand[50]
              : getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')
          "
        >
          <span
            :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
            :style="{
              color: getSelectTypeOptionTextColor(getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)'), getColor),
            }"
            class="flex items-stretch gap-2"
          >
            <div class="flex-none">
              <GeneralUserIcon
                :is-deleted="!isCollaborator(selectedOpt.value)"
                :disabled="!isCollaborator(selectedOpt.value)"
                size="auto"
                :user="{
                  display_name: !selectedOpt.label?.includes('@') ? selectedOpt.label.trim() : '',
                  email: selectedOpt.label,
                  meta: selectedOpt.meta,
                }"
                class="!text-[0.5rem] !h-[16.8px]"
                :class="{
                  '!bg-nc-bg-default': selectedOpt.value === CURRENT_USER_TOKEN,
                }"
                :show-placeholder-icon="selectedOpt.value === CURRENT_USER_TOKEN"
              />
            </div>
            <NcTooltip
              class="truncate max-w-full"
              :show-on-truncate-only="isCollaborator(selectedOpt.value) || selectedOpt.value === CURRENT_USER_TOKEN"
            >
              <template #title>
                <template v-if="!isCollaborator(selectedOpt.value) && selectedOpt.value !== CURRENT_USER_TOKEN">
                  <div class="flex flex-col gap-0.5 py-0.5">
                    <span v-if="selectedOpt.display_name?.trim()" class="font-semibold">
                      {{ selectedOpt.display_name.trim() }}
                    </span>
                    <span class="text-nc-content-gray-subtle2">{{ selectedOpt.email }}</span>
                    <span class="flex items-center gap-1 text-nc-content-gray-muted mt-0.5">
                      <GeneralIcon icon="ncSlash" class="w-3 h-3 flex-none" />
                      {{ $t('labels.noBaseAccess') }}
                    </span>
                  </div>
                </template>
                <template v-else>
                  {{ selectedOpt.value === CURRENT_USER_TOKEN ? selectedOpt.label : extractUserDisplayNameOrEmail(selectedOpt) }}
                </template>
              </template>
              <span
                :class="{
                  'text-nc-content-gray-muted': !isCollaborator(selectedOpt.value) && selectedOpt.value !== CURRENT_USER_TOKEN,
                  'text-nc-content-brand': selectedOpt.value === CURRENT_USER_TOKEN,
                  'font-600': isInFilter,
                }"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
                class="text-ellipsis overflow-hidden"
              >
                {{ selectedOpt.value === CURRENT_USER_TOKEN ? selectedOpt.label : extractUserDisplayNameOrEmail(selectedOpt) }}
              </span>
            </NcTooltip>
          </span>
        </a-tag>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ms-close-icon {
  color: rgba(var(--rgb-base), 0.25);
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-style: normal;
  height: 12px;
  line-height: 1;
  text-align: center;
  text-transform: none;
  transition: color 0.3s ease, opacity 0.15s ease;
  width: 12px;
  z-index: 1;
  margin-right: -6px;
  margin-left: 3px;
}

.ms-close-icon:before {
  display: block;
}

.ms-close-icon:hover {
  color: rgba(var(--rgb-base), 0.45);
}

.read-only {
  .ms-close-icon {
    display: none;
  }
}

.rounded-tag {
  @apply bg-nc-bg-gray-medium px-2 rounded-[12px];
}

:deep(.ant-tag) {
  /* keep in sync with .rounded-tag above */
  @apply bg-nc-bg-gray-medium px-2 rounded-[12px] my-[1px];
}

:deep(.nc-user-avatar) {
  @apply min-h-4.2;
}
</style>
