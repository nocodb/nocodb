<script lang="ts" setup>
import type { SyncCategory } from 'nocodb-sdk'
import { SyncCategoryMeta } from 'nocodb-sdk'

const props = defineProps<{
  modelValue?: SyncCategory
}>()

const emits = defineEmits(['update:modelValue', 'change'])

const categories = Object.values(SyncCategoryMeta)

const vModel = useVModel(props, 'modelValue', emits)

const selectCategory = (value: SyncCategory) => {
  vModel.value = value
  emits('change', value)
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div
      v-for="category in categories"
      :key="category.value"
      class="nc-category-card"
      :class="{
        'nc-category-selected': vModel === category.value,
      }"
      @click="selectCategory(category.value)"
    >
      <div class="flex items-start gap-3">
        <div class="nc-category-icon">
          <GeneralIcon :icon="category.icon" class="w-5 h-5" />
        </div>
        <div class="flex-1">
          <div class="nc-category-title">{{ category.label }}</div>
          <div class="nc-category-description">{{ category.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-category-card {
  @apply p-4 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200;
  @apply hover:border-brand-500 hover:bg-brand-50/30;

  &.nc-category-selected {
    @apply border-brand-500 bg-brand-50/50;

    .nc-category-icon {
      @apply bg-brand-500 text-white;
    }

    .nc-category-title {
      @apply text-brand-600;
    }
  }
}

.nc-category-icon {
  @apply w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center;
  @apply text-gray-600 transition-all duration-200;
}

.nc-category-title {
  @apply text-sm font-semibold text-gray-800 mb-1;
}

.nc-category-description {
  @apply text-xs text-gray-500 leading-relaxed;
}
</style>
