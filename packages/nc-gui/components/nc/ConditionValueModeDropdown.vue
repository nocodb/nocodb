<script setup lang="ts">
/**
 * Gear menu that switches a condition's value between a picked static value and
 * a dynamic one. Mirrors the grid filter's menu (`Filter/FilterRow.vue`), which
 * still carries its own copy — see the PR notes.
 */
interface Props {
  modelValue: 'static' | 'dynamic'
  disabled?: boolean
  /** Disable the dynamic entry when the condition cannot take a dynamic value. */
  dynamicDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  dynamicDisabled: false,
})

const emits = defineEmits<{
  'update:modelValue': [value: 'static' | 'dynamic']
}>()

const { t } = useI18n()

const isOpen = ref(false)

const modes = computed(() => [
  {
    value: 'static' as const,
    title: t('labels.staticCondition'),
    description: t('labels.filterBasedOnStaticValue'),
    disabled: false,
  },
  {
    value: 'dynamic' as const,
    title: t('labels.dynamicCondition'),
    description: t('labels.filterBasedOnDynamicValue'),
    disabled: props.dynamicDisabled,
  },
])

function selectMode(value: 'static' | 'dynamic', modeDisabled: boolean) {
  if (modeDisabled || value === props.modelValue) return

  emits('update:modelValue', value)
  isOpen.value = false
}
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :disabled="disabled"
    :trigger="['click']"
    placement="bottomRight"
    overlay-class-name="nc-dropdown-condition-value-mode"
  >
    <NcButton type="text" size="small" data-testid="nc-condition-value-mode-btn">
      <GeneralIcon icon="settings" class="w-4 h-4" />
    </NcButton>

    <template #overlay>
      <div class="flex flex-col gap-0.5 p-1.5 w-70">
        <div
          v-for="mode in modes"
          :key="mode.value"
          class="px-3 py-2 flex flex-col gap-1 select-none rounded-md"
          :class="mode.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-nc-bg-gray-light'"
          :data-testid="`nc-condition-value-mode-${mode.value}`"
          @click="selectMode(mode.value, mode.disabled)"
        >
          <div class="flex items-center justify-between gap-2 w-full text-nc-content-gray">
            <span class="truncate">{{ mode.title }}</span>
            <GeneralIcon v-if="modelValue === mode.value" icon="check" class="flex-none w-4 h-4 text-primary" />
          </div>
          <div class="text-xs text-nc-content-gray-disabled">{{ mode.description }}</div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>
