<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

interface StackFieldOption {
  value: string
  label?: string
  col?: ColumnType
  disabled?: boolean
}

interface Props {
  step: 'stack' | 'newField'
  /** Existing fields: stackable ones, and links that can't stack here (disabled) */
  options: StackFieldOption[]
  /** "Create a new … field" choices; empty when the user can't add fields */
  createOptions: { value: KanbanNewStackFieldValue; label: string }[]
  fieldId: string | null
  newFieldKind: KanbanNewStackFieldValue | null
  newFieldTitle: string
  newFieldTitleError?: string
  notify: boolean
  hideEmptyStack: boolean
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (event: 'update:step', value: Props['step']): void
  (event: 'update:fieldId', value: string | null): void
  (event: 'update:newFieldKind', value: KanbanNewStackFieldValue | null): void
  (event: 'update:newFieldTitle', value: string): void
  (event: 'update:notify', value: boolean): void
  (event: 'update:hideEmptyStack', value: boolean): void
  (event: 'back'): void
  (event: 'submit'): void
}>()

const fieldId = useVModel(props, 'fieldId', emits)
const newFieldTitle = useVModel(props, 'newFieldTitle', emits)
const notify = useVModel(props, 'notify', emits)
const hideEmptyStack = useVModel(props, 'hideEmptyStack', emits)

const { t } = useI18n()

const titleInputEl = ref<HTMLInputElement>()

const isSelectKind = computed(() => props.newFieldKind === KANBAN_NEW_SINGLE_SELECT_FIELD)

const kindIconColumn = (kind: KanbanNewStackFieldValue) =>
  (kind === KANBAN_NEW_SINGLE_SELECT_FIELD
    ? { uidt: UITypes.SingleSelect }
    : { uidt: UITypes.User, meta: { is_multi: false } }) as ColumnType

const kindHint = (kind: KanbanNewStackFieldValue) =>
  kind === KANBAN_NEW_SINGLE_SELECT_FIELD
    ? t('activity.kanban.createSingleSelectFieldHint')
    : t('activity.kanban.createUserFieldHint')

const chooseNewField = (kind: KanbanNewStackFieldValue) => {
  emits('update:newFieldKind', kind)
  emits('update:step', 'newField')
}

watch(
  () => props.step,
  (step) => {
    if (step === 'newField') nextTick(() => titleInputEl.value?.select())
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-kanban-stack-field-step flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <NcButton type="text" size="xsmall" class="nc-kanban-stack-field-back !px-1" @click="emits('back')">
        <div class="flex items-center gap-0.5 text-nc-content-brand">
          <GeneralIcon icon="ncChevronLeft" class="w-4 h-4" />
          {{ $t('general.back') }}
        </div>
      </NcButton>
      <div class="text-sm font-semibold text-nc-content-gray truncate">
        <template v-if="step === 'stack'">{{ $t('activity.kanban.chooseStackField') }}</template>
        <template v-else>{{ newFieldKind ? createOptions.find((o) => o.value === newFieldKind)?.label : '' }}</template>
      </div>
    </div>

    <template v-if="step === 'stack'">
      <div class="text-sm text-nc-content-gray-subtle2">{{ $t('activity.kanban.chooseStackFieldDesc') }}</div>

      <div class="nc-kanban-stack-field-list flex flex-col max-h-[280px] overflow-y-auto nc-scrollbar-thin -mx-1">
        <a-radio-group v-model:value="fieldId" class="!flex flex-col">
          <NcTooltip
            v-for="option of options"
            :key="option.value"
            :disabled="!option.disabled"
            :title="$t('activity.kanban.linkTypeNotStackable')"
            placement="right"
            class="w-full"
          >
            <a-radio
              :value="option.value"
              :disabled="option.disabled"
              class="nc-kanban-stack-field-option"
              :data-testid="`nc-kanban-stack-field-${option.label}`"
            >
              <div
                class="flex items-center gap-1.5 min-w-0"
                :class="option.disabled ? 'text-nc-content-gray-disabled' : 'text-nc-content-gray'"
              >
                <SmartsheetHeaderIcon
                  v-if="option.col"
                  :column="option.col"
                  class="!ml-0 flex-none"
                  :class="{ 'grayscale opacity-50': option.disabled }"
                  color="text-current"
                />
                <NcTooltip class="truncate" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
            </a-radio>
          </NcTooltip>
        </a-radio-group>

        <div
          v-for="option of createOptions"
          :key="option.value"
          class="nc-kanban-stack-field-create"
          :data-testid="`nc-kanban-stack-field-create-${option.value}`"
          role="button"
          tabindex="0"
          @click="chooseNewField(option.value)"
          @keydown.enter.prevent="chooseNewField(option.value)"
        >
          <div class="w-4 h-5 flex-none flex items-center justify-center">
            <GeneralIcon icon="plus" class="w-4 h-4 text-nc-content-gray-subtle" />
          </div>
          <!-- the hint sits in the label's column, under its text -->
          <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 min-w-0 flex-1">
            <SmartsheetHeaderIcon :column="kindIconColumn(option.value)" class="!ml-0 flex-none" color="text-nc-content-gray" />
            <span class="truncate text-nc-content-gray">{{ option.label }}</span>
            <div class="col-start-2 text-xs text-nc-content-gray-muted truncate">{{ kindHint(option.value) }}</div>
          </div>
        </div>
      </div>

      <div class="flex items-center">
        <NcSwitch v-model:checked="hideEmptyStack" size="small" class="nc-kanban-stack-field-hide-empty">
          <div class="text-sm text-nc-content-gray">{{ $t('labels.hideEmptyStacks') }}</div>
        </NcSwitch>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-1.5">
        <div class="text-[13px] font-medium text-nc-content-gray">{{ $t('labels.columnName') }}</div>
        <a-input
          ref="titleInputEl"
          v-model:value="newFieldTitle"
          class="nc-kanban-stack-field-title nc-input-sm nc-input-shadow"
          :class="{ '!border-nc-border-red': newFieldTitleError }"
          @keydown.enter.prevent="emits('submit')"
        />
        <div v-if="newFieldTitleError" class="text-xs text-nc-content-red-medium">{{ newFieldTitleError }}</div>
      </div>

      <div v-if="!isSelectKind" class="flex items-center">
        <NcSwitch v-model:checked="notify" size="small" class="nc-kanban-stack-field-notify">
          <div class="text-sm text-nc-content-gray">{{ $t('labels.notifyUsersWithBaseAccessWhenAdded') }}</div>
        </NcSwitch>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-stack-field-option {
  @apply !flex items-center w-full !mr-0 px-1 py-1.5 rounded-md;

  // antd nudges the radio down to sit on a text baseline; centre it on the row instead
  :deep(.ant-radio) {
    @apply !top-0;
  }

  &:not(.ant-radio-wrapper-disabled):hover {
    @apply bg-nc-bg-gray-light;
  }

  :deep(.ant-radio + span) {
    @apply min-w-0 flex-1 !pl-2;
  }
}

.nc-kanban-stack-field-create {
  @apply flex items-start gap-2 px-1 py-1.5 rounded-md cursor-pointer outline-none text-sm leading-5;

  &:hover,
  &:focus-visible {
    @apply bg-nc-bg-gray-light;
  }
}
</style>
