<script lang="ts" setup>
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from 'ant-design-vue'
import type { UserFieldRecordType } from 'nocodb-sdk'
import { getOptions, getSelectedUsers } from './utils'

interface Props {
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null
  rowIndex?: number
  location?: 'cell' | 'filter'
  forceMulti?: boolean
  options?: UserFieldRecordType[]
}

const { modelValue, forceMulti, options: userOptions } = defineProps<Props>()

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const basesStore = useBases()

const baseStore = useBase()

const { basesUser } = storeToRefs(basesStore)

const { idUserMap } = storeToRefs(baseStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const isForm = inject(IsFormInj, ref(false))

const isMultiple = computed(() => forceMulti || (column.value.meta as { is_multi: boolean; notify: boolean })?.is_multi)

const rowHeight = inject(RowHeightInj, ref(undefined))

const isKanban = inject(IsKanbanInj, ref(false))

const options = computed(() => {
  return userOptions ?? getOptions(column.value, false, isForm.value, baseUsers.value)
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
  return !idUserMap.value?.[userIdOrEmail]?.deleted
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
                  color: getSelectTypeOptionTextColor('#ccc'),
                }"
                class="flex items-stretch gap-2 text-small"
              >
                <div>
                  <GeneralUserIcon :disabled="!isCollaborator(op.id)" :user="op" class="!text-[0.5rem] !h-[16.8px]" size="auto" />
                </div>
                <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ op.display_name?.trim() || op.email }}
                  </template>
                  <span
                    :class="{
                      'text-gray-600': !isCollaborator(op.id || op.email),
                    }"
                    :style="{
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                      display: 'inline',
                    }"
                    class="text-ellipsis overflow-hidden"
                  >
                    {{ op.display_name?.trim() || op.email }}
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
      class="flex overflow-hidden gap-y-1 flex-wrap"
      :style="{
        'max-width': '100%',
        '-webkit-line-clamp': rowHeightTruncateLines(rowHeight, true),
        'maxHeight': `${rowHeightInPx[rowHeight] - 12}px`,
      }"
    >
      <template v-for="selectedOpt of selectedUsers" :key="selectedOpt.value">
        <a-tag
          :class="{
            '!my-0': !rowHeight || rowHeight === 1,
          }"
          class="rounded-tag max-w-full !pl-0"
          color="'#ccc'"
        >
          <span
            :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
            :style="{
              color: getSelectTypeOptionTextColor('#ccc'),
            }"
            class="flex items-stretch gap-2"
          >
            <div class="flex-none">
              <GeneralUserIcon
                :disabled="!isCollaborator(selectedOpt.value)"
                size="auto"
                :user="{
                  display_name: !selectedOpt.label?.includes('@') ? selectedOpt.label.trim() : '',
                  email: selectedOpt.label,
                  meta: selectedOpt.meta,
                }"
                class="!text-[0.5rem] !h-[16.8px]"
              />
            </div>
            <NcTooltip class="truncate max-w-full" show-on-truncate-only>
              <template #title>
                {{ selectedOpt.label }}
              </template>
              <span
                :class="{
                  'text-gray-600': !isCollaborator(selectedOpt.value),
                }"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
                class="text-ellipsis overflow-hidden"
              >
                {{ selectedOpt.label }}
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
  color: rgba(0, 0, 0, 0.25);
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
  color: rgba(0, 0, 0, 0.45);
}

.read-only {
  .ms-close-icon {
    display: none;
  }
}

.rounded-tag {
  @apply bg-gray-200 px-2 rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-[1px];
}

:deep(.ant-tag-close-icon) {
  @apply "text-slate-500";
}

:deep(.nc-user-avatar) {
  @apply min-h-4.2;
}
</style>
