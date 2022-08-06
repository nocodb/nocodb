<script setup lang="ts">
import { Sketch } from '@ckpack/vue-color'
import { useColumnCreateStoreOrThrow } from '#imports'
import { enumColor, getMdiIcon } from '@/utils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

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

const advanced = ref(true)

const picked = ref(formState.value.meta.color || enumColor.light[0])

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
    <a-card class="w-full shadow-lg mt-2" body-style="padding: 0px">
      <a-collapse v-model:activeKey="advanced" accordion ghost expand-icon-position="right">
        <a-collapse-panel key="1" header="Advanced" class="">
          <a-button class="!bg-primary text-white w-full" @click="formState.meta.color = picked.hex"> Pick Color </a-button>
          <div class="px-7 py-3">
            <Sketch v-model="picked" />
          </div>
        </a-collapse-panel>
      </a-collapse>
    </a-card>
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
