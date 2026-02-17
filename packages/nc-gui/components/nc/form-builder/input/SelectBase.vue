<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    dropdownMatchSelectWidth?: boolean
    filterOption?: (base: NcProject) => boolean
  }>(),
  {
    dropdownMatchSelectWidth: true,
  },
)

const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const basesStore = useBases()

const baseOptions = computed(() => {
  return basesStore.basesList
    .filter((base) => !props.filterOption || props.filterOption(base))
    .map((base) => ({
      label: base.title,
      value: base.id,
      meta: base.meta,
      managed_app_master: base.managed_app_master,
      managed_app_id: base.managed_app_id,
    }))
})
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    :disabled="disabled"
    :show-search="baseOptions.length > 4"
    allow-clear
    :filter-option="(input, option) => antSelectFilterOption(input, option, ['data-label'])"
    placeholder="- Select base -"
    :dropdown-match-select-width="dropdownMatchSelectWidth"
  >
    <a-select-option v-for="option of baseOptions" :key="option.value" :value="option.value" :data-label="option.label">
      <div class="w-full flex gap-2 items-center" :data-testid="option.value">
        <div class="min-w-5 flex items-center justify-center">
          <GeneralProjectIcon
            :color="parseProp(option.meta).iconColor"
            :managed-app="{
              managed_app_master: option.managed_app_master,
              managed_app_id: option.managed_app_id,
            }"
            size="small"
          />
        </div>
        <NcTooltip class="flex-1 truncate min-w-0" show-on-truncate-only>
          <template #title>
            {{ option.label }}
          </template>
          {{ option.label }}
        </NcTooltip>
        <GeneralIcon
          v-if="vModel === option.value"
          id="nc-selected-item-icon"
          icon="check"
          class="text-nc-content-brand w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>
