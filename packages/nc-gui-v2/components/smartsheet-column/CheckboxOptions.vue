<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { getMdiIcon } from '@/utils'

const { formState } = useColumnCreateStoreOrThrow()

// cater existing v1 cases
const iconList = [
  {
    checked: 'mdi-check-bold',
    unchecked: 'mdi-crop-square',
  },
  {
    checked: 'mdi-check-circle-outline',
    unchecked: 'mdi-checkbox-blank-circle-outline',
  },
  {
    checked: 'mdi-star',
    unchecked: 'mdi-star-outline',
  },
  {
    checked: 'mdi-heart',
    unchecked: 'mdi-heart-outline',
  },
  {
    checked: 'mdi-moon-full',
    unchecked: 'mdi-moon-new',
  },
  {
    checked: 'mdi-thumb-up',
    unchecked: 'mdi-thumb-up-outline',
  },
  {
    checked: 'mdi-flag',
    unchecked: 'mdi-flag-outline',
  },
]

const picked = computed({
  get: () => formState.value.meta.color,
  set: (val) => {
    formState.value.meta.color = val
  },
})

// set default value
formState.value.meta = {
  icon: {
    checked: 'mdi-check-bold',
    unchecked: 'mdi-crop-square',
  },
  color: '#777',
  ...formState.value.meta,
}

// antdv doesn't support object as value
// use iconIdx as value and update back in watch
const iconIdx = iconList.findIndex(
  (ele) => ele.checked === formState.value.meta.icon.checked && ele.unchecked === formState.value.meta.icon.unchecked,
)

formState.value.meta.iconIdx = iconIdx === -1 ? 0 : iconIdx

watch(
  () => formState.value.meta.iconIdx,
  (v) => {
    formState.value.meta.icon = iconList[v]
  },
)
</script>

<template>
  <a-row>
    <a-col :span="24">
      <a-form-item label="Icon">
        <a-select v-model:value="formState.meta.iconIdx" size="small" class="w-52">
          <a-select-option v-for="(icon, i) of iconList" :key="i" :value="i">
            <component
              :is="getMdiIcon(icon.checked)"
              class="mx-1"
              :style="{
                color: formState.meta.color,
              }"
            />
            <component
              :is="getMdiIcon(icon.unchecked)"
              :style="{
                color: formState.meta.color,
              }"
            />
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
  <a-row>
    <GeneralColorPicker
      v-model="picked"
      :row-size="8"
      :colors="['#fcb401', '#faa307', '#f48c06', '#e85d04', '#dc2f02', '#d00000', '#9d0208', '#777']"
    />
  </a-row>
</template>

<style scoped lang="scss">
.color-selector:hover {
  @apply brightness-90;
}

.color-selector.selected {
  @apply py-[5px] px-[10px] brightness-90;
}
</style>
