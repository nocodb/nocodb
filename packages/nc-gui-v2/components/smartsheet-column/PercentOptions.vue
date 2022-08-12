<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { precisions } from '@/utils/percentUtils'

const { formState } = $(useColumnCreateStoreOrThrow())

if (!formState.meta) formState.meta = {}
if (!formState.meta?.precision) formState.meta.precision = precisions[0].id
if (!formState.meta?.negative) formState.meta.negative = false
if (!formState.meta?.default) formState.meta.default = null
</script>

<template>
  <div class="flex flex-col mt-2 gap-2">
    <div class="flex flex-row space-x-2">
      <a-form-item class="flex w-1/2" label="Precision">
        <a-select v-model:value="formState.meta.precision">
          <a-select-option v-for="(precision, i) of precisions" :key="i" :value="precision.id">
            <div class="flex flex-row items-center">
              <div class="text-xs">
                {{ precision.title }}
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Default Number (%)">
        <a-input v-model:value="formState.meta.default" name="default" type="number" />
      </a-form-item>
    </div>
    <div class="flex flex-row mt-2">
      <a-form-item>
        <div class="flex flex-row space-x-2 items-center">
          <a-switch v-model:checked="formState.meta.negative" name="negative" />
          <div class="text-xs">Allow negative numbers</div>
        </div>
      </a-form-item>
    </div>
  </div>
</template>
