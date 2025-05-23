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
  <div class="w-full flex flex-wrap gap-4 max-h-[300px] overflow-y-auto">
    <template v-for="category in categories" :key="category.value">
      <NcAlert
        type="info"
        :message="category.label"
        :description="category.description"
        show-icon
        class="cursor-pointer hover:!bg-gray-50"
        :class="{
          '!border-primary': vModel === category.value,
        }"
        @click="selectCategory(category.value)"
      >
        <template #icon>
          <GeneralIcon :icon="category.icon" class="text-primary mt-1" />
        </template>
      </NcAlert>
    </template>
  </div>
</template>
