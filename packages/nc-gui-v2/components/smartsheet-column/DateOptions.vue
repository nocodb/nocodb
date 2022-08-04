<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { dateFormats } from '~/utils/dateTimeUtils'

const { formState } = $(useColumnCreateStoreOrThrow())

if (!formState.meta?.date_format) {
  if (!formState.meta) formState.meta = {}
  formState.meta.date_format = dateFormats[0]
}
</script>

<template>
  <a-form-item label="Date Format">
    <a-select v-model:value="formState.meta.date_format" size="small">
      <a-select-option v-for="(format, i) of dateFormats" :key="i" :value="format">
        <div class="flex flex-row items-center">
          <div class="text-xs">
            {{ format }}
          </div>
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
