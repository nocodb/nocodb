<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { getMdiIcon } from '@/utils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

// cater existing v1 cases
const iconList = ref([
  {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  {
    full: 'mdi-heart',
    empty: 'mdi-heart-outline',
  },
  {
    full: 'mdi-moon-full',
    empty: 'mdi-moon-new',
  },
  {
    full: 'mdi-thumb-up',
    empty: 'mdi-thumb-up-outline',
  },
  {
    full: 'mdi-flag',
    empty: 'mdi-flag-outline',
  },
])
</script>

<template>
  <a-row>
    <a-col :span="12">
      <a-form-item label="Icon">
        <a-select v-model:value="formState.meta.icon" size="small" class="w-52">
          <!-- TODO: handle value -->
          <a-select-option v-for="(icon, i) in iconList ?? []" :key="i" :value="icon">
            <component
              :is="getMdiIcon(icon.full)"
              :style="{
                color: formState.meta.color,
              }"
            />
            {{ ' ' }}
            <component
              :is="getMdiIcon(icon.empty)"
              :style="{
                color: formState.meta.color,
              }"
            />
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item label="Max">
        <a-select v-model:value="formState.meta.max" class="w-52" show-search :filter-option="filterOption" size="small">
          <a-select-option v-for="(v, i) in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" :key="i" :value="v">
            {{ v }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
  <!-- TODO: add color picker -->
</template>
