<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { durationOptions } from '@/utils/durationUtils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

const durationOptionList = computed(() =>
  durationOptions.map((o: Record<string, any>) => ({
    ...o,
    // h:mm:ss (e.g. 3:45, 1:23:40)
    title: `${o.title} ${o.example}`,
  })),
)
</script>

<template>
  <a-row>
    <a-col :span="24">
      <span class="prose-sm mt-2">A duration of time in minutes or seconds (e.g. 1:23).</span>
    </a-col>
    <a-col :span="24">
      <a-form-item label="Duration Format">
        <a-select v-model:value="formState.meta.duration" size="small" class="w-52">
          <a-select-option v-for="(duration, i) in durationOptionList ?? []" :key="i" :value="duration.id">
            {{ duration.title }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
</template>
