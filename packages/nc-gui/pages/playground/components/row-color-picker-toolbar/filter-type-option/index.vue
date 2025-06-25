<script lang="ts" setup>
import type { RowColoringMode } from 'nocodb-sdk'

const rowColoringMode = ref<RowColoringMode>(null)
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>
      <div>
        Row coloring mode: {{ rowColoringMode }}
        <NcButton type="secondary" size="small" @click="rowColoringMode = null">Clear</NcButton>
      </div>
    </a-card>
    <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode">
      <template #filter>
        <div class="bg-white animate-animated animate-fadeIn" style="animation-duration: 0.3s">
          This is filter panel <NcButton type="secondary" size="small" @click="rowColoringMode = null">Clear</NcButton>
        </div>
      </template>

      <template #select>
        <div class="bg-white animate-animated animate-fadeIn" style="animation-duration: 0.3s">
          This is select panel <NcButton type="secondary" size="small" @click="rowColoringMode = null">Clear</NcButton>
        </div>
      </template>
    </SmartsheetToolbarRowColorFilterTypeOption>
  </div>
</template>
