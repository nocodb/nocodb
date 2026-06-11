<script lang="ts" setup>
interface Props {
  field: Record<string, any>
  isEditable: boolean
  isLocked: boolean
  // True while a drag is in progress — suppresses tooltips so they don't flicker mid-drag.
  drag: boolean
}

const props = defineProps<Props>()

const emits = defineEmits<{
  'activate': []
  'toggle-show': [value: boolean]
}>()

const { isRequired, activeRow } = useFormViewStoreOrThrow()

// Derived from the store locally (not a parent-computed prop) so the parent's render effect
// doesn't depend on `activeRow`. On a field switch only the two items whose value flips
// re-render; the parent never re-walks the list.
const isActive = computed(() => activeRow.value === props.field.id)
</script>

<template>
  <div
    class="w-full px-2 flex flex-row items-center border-b-1 last:border-none border-nc-border-gray-medium"
    :class="[
      `nc-form-field-item-${field.title.replaceAll(' ', '')}`,
      `${isActive ? 'bg-nc-bg-brand font-medium' : 'hover:bg-nc-bg-gray-extralight'}`,
    ]"
    :data-testid="`nc-form-field-item-${field.title}`"
  >
    <div class="py-1.5 flex items-center">
      <component :is="iconMap.drag" class="flex-none cursor-move !h-4 !w-4 text-nc-content-gray-subtle2 mr-1" />
    </div>
    <div class="flex-1 flex items-center justify-between cursor-pointer max-w-[calc(100%_-_20px)] py-1.5">
      <div class="flex-1 flex items-center cursor-pointer max-w-[calc(100%_-_40px)]" @click.prevent="emits('activate')">
        <SmartsheetHeaderIcon :column="field" color="text-nc-content-gray-subtle" />

        <div class="flex-1 flex items-center justify-start max-w-[calc(100%_-_28px)]">
          <div class="w-full flex items-center">
            <div class="ml-1 inline-flex" :class="field.label?.trim() ? 'max-w-1/2' : 'max-w-[95%]'">
              <NcTooltip class="truncate text-sm" :disabled="drag" show-on-truncate-only>
                <template #title>
                  <div class="text-center">
                    {{ field.title }}
                  </div>
                </template>
                <span data-testid="nc-field-title"> {{ field.title }} </span>
              </NcTooltip>
            </div>
            <div
              v-if="field.label?.trim() && field.title !== field.label?.trim()"
              class="truncate inline-flex text-xs font-normal text-nc-content-inverted-secondary"
            >
              <span>&nbsp;(</span>
              <NcTooltip class="truncate" :disabled="drag" show-on-truncate-only>
                <template #title>
                  <div class="text-center">
                    {{ field.label }}
                  </div>
                </template>
                <span data-testid="nc-field-title ">{{ field.label?.trim() }}</span>
              </NcTooltip>
              <span>)</span>
            </div>

            <span v-if="isRequired(field, field.required)" class="text-nc-content-red-medium text-sm align-top"> &nbsp;* </span>
            <div class="flex items-center">
              <LazySmartsheetFormFieldConfigError :column="field" mode="list" />
            </div>
          </div>
        </div>
      </div>

      <NcTooltip :disabled="!field.required || isLocked || !isEditable" class="flex" placement="topRight">
        <template #title> {{ $t('tooltip.youCantHideARequiredField') }} </template>
        <a-switch
          :checked="!!field.show"
          :disabled="field.required || isLocked || !isEditable"
          class="flex-none nc-switch"
          size="small"
          @change="(value) => emits('toggle-show', value as boolean)"
        />
      </NcTooltip>
    </div>
  </div>
</template>
