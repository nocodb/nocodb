<script setup lang="ts">
import { isVirtualCol } from 'nocodb-sdk'

interface Props {
  element: Record<string, any>
  isLocked: boolean
  isEditable: boolean
  variant: 'grid' | 'single-column'
}

const props = defineProps<Props>()

const {
  activeRow,
  allViewFilters,
  fieldMappings,
  formState,
  isRequired,
  updateColMeta,
  validateInfos,
} = useFormViewStoreOrThrow()

const { row } = useSmartsheetRowStoreOrThrow()

function onItemClick() {
  if (props.isLocked || !props.isEditable) return
  activeRow.value = props.element.id
}

function remove() {
  emit('remove', props.element)
}

const emit = defineEmits<{
  (e: 'remove', element: Record<string, any>): void
}>()
</script>

<template>
  <div
    v-if="!isLocked || (isLocked && element?.visible)"
    :key="element.id"
    class="nc-editable nc-form-focus-element item relative bg-nc-bg-default"
    :class="[
      `nc-form-drag-${element.title.replaceAll(' ', '')}`,
      variant === 'grid'
        ? 'p-2 flex-1 basis-0 min-w-0'
        : 'p-4 lg:p-6',
      {
        'nc-form-field-drag-handler rounded-2xl my-1 cursor-move': isEditable && variant === 'grid',
      },
      {
        'rounded-2xl border-2 my-1': isEditable && variant === 'single-column',
      },
      {
        'border-transparent my-0': !isEditable && variant === 'single-column',
      },
      {
        'my-0': !isEditable && variant === 'grid',
      },
      {
        'nc-form-field-drag-handler border-transparent hover:(bg-nc-bg-gray-extralight) cursor-pointer':
          variant === 'single-column' && activeRow !== element.id && isEditable,
      },
      {
        'hover:(bg-nc-bg-gray-extralight)':
          variant === 'grid' && activeRow !== element.id && isEditable,
      },
      {
        'ring-1 ring-inset ring-nc-border-brand':
          variant === 'grid' && activeRow === element.id,
      },
      {
        'border-nc-border-brand':
          variant === 'single-column' && activeRow === element.id,
      },
      {
        '!hover:bg-nc-bg-default !ring-0 !cursor-auto': isLocked,
      },
    ]"
    :data-title="element.title"
    :data-row-id="element.row_id || ''"
    data-testid="nc-form-fields"
    @click.stop="onItemClick"
  >
    <template v-if="activeRow === element.id">
      <div v-if="variant === 'single-column'" class="absolute -left-3 top-6">
        <NcButton
          type="primary"
          size="small"
          class="nc-form-field-drag-handler !cursor-move !p-1 !min-w-6 !h-auto !rounded"
        >
          <component
            :is="iconMap.drag"
            class="nc-form-field-drag-handler flex-none !h-4 !w-4 text-white font-bold"
          />
        </NcButton>
      </div>
      <div :class="variant === 'grid' ? 'absolute right-1 top-1' : 'absolute right-1 top-1'">
        <NcTooltip
          :title="
            isRequired(element, element.required)
              ? $t('tooltip.youCantRemoveARequiredField')
              : $t('tooltip.removeFromForm')
          "
        >
          <NcButton
            v-if="variant === 'grid'"
            type="link"
            size="xsmall"
            class="nc-form-field-hide !bg-white !h-5 !w-5 !min-w-5 !rounded-full"
            :class="{
              '!text-nc-content-gray-muted !hover:text-nc-content-brand': !isRequired(
                element,
                element.required,
              ),
            }"
            icon-only
            :disabled="isRequired(element, element.required)"
            @click="remove"
          >
            <template #icon>
              <GeneralIcon icon="close" class="!w-4 !h-4" />
            </template>
          </NcButton>
          <NcButton
            v-else
            type="link"
            size="xsmall"
            class="nc-form-field-hide !bg-transparent !h-6 !w-6"
            :class="{
              '!text-nc-content-gray-muted !hover:text-nc-content-brand': !isRequired(
                element,
                element.required,
              ),
            }"
            icon-only
            :disabled="isRequired(element, element.required)"
            @click="remove"
          >
            <template #icon>
              <GeneralIcon icon="close" class="!w-4 !h-4" />
            </template>
          </NcButton>
        </NcTooltip>
      </div>
    </template>
    <div class="flex items-center gap-3">
      <NcTooltip
        v-if="allViewFilters[element.fk_column_id]?.length && !isLocked"
        class="relative h-3.5 w-3.5 flex cursor-pointer"
        placement="topLeft"
      >
        <template #title>{{ $t('tooltip.conditionallyVisibleField') }}</template>
        <Transition name="icon-fade" :duration="500">
          <GeneralIcon
            v-if="element?.visible"
            icon="eye"
            class="nc-field-visibility-icon nc-field-visible w-3.5 h-3.5 flex-none text-nc-content-gray-muted"
          />
          <GeneralIcon
            v-else
            icon="eyeSlash"
            class="nc-field-visibility-icon w-3.5 h-3.5 flex-none text-nc-content-gray-muted"
          />
        </Transition>
      </NcTooltip>
      <div
        :class="
          variant === 'grid'
            ? 'text-sm font-medium text-nc-content-gray'
            : 'text-sm font-semibold text-nc-content-gray'
        "
      >
        <span data-testid="nc-form-input-label">
          {{ element.label || element.title }}
        </span>
        <span
          v-if="isRequired(element, element.required)"
          class="text-nc-content-red-medium text-base leading-[18px]"
        >
          &nbsp;*
        </span>
      </div>
    </div>

    <LazyCellRichText
      v-if="element.description"
      :value="element.description"
      is-form-field
      read-only
      sync-value-change
      class="nc-form-help-text !h-auto text-nc-content-gray-muted"
      :class="variant === 'grid' ? 'text-xs mt-1 -ml-1' : 'text-sm mt-2 -ml-1'"
      data-testid="nc-form-help-text"
      @update:value="updateColMeta(element)"
    />

    <!-- Field Body -->
    <div class="nc-form-field-body">
      <div class="mt-2">
        <a-form-item
          v-if="fieldMappings[element.title]"
          :name="fieldMappings[element.title]"
          class="!my-0 nc-input-required-error nc-form-input-item"
          v-bind="validateInfos[fieldMappings[element.title]]"
        >
          <LazySmartsheetDivDataCell class="relative" @click.stop>
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(element)"
              v-model="formState[element.title]"
              :row="row"
              class="nc-input"
              :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
              :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
              :column="element"
            />
            <LazySmartsheetCell
              v-else
              v-model="formState[element.title]"
              class="nc-input truncate"
              :class="[
                `nc-form-input-${element.title.replaceAll(' ', '')}`,
                { 'layout-list': element.meta.isList },
              ]"
              :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
              :column="element"
              :edit-enabled="true"
            />
          </LazySmartsheetDivDataCell>
        </a-form-item>

        <div>
          <LazySmartsheetFormFieldConfigError :column="element" mode="preview" />
        </div>
      </div>
    </div>
  </div>
</template>
