<script setup lang="ts">
import { Sketch } from '@ckpack/vue-color'
import { useColumnCreateStoreOrThrow } from '#imports'
import { enumColor, getMdiIcon } from '@/utils'

const { formState } = useColumnCreateStoreOrThrow()

// cater existing v1 cases
const iconList = [
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
]

const advanced = ref(true)

const picked = ref(formState.value.meta.color || enumColor.light[0])

// set default value
formState.value.meta = {
  iconIdx: 0,
  icon: {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  color: '#fcb401',
  max: 5,
  ...formState.value.meta,
}

// antdv doesn't support object as value
// use iconIdx as value and update back in watch
const iconIdx = iconList.findIndex(
  (ele) => ele.full === formState.value.meta.icon.full && ele.empty === formState.value.meta.icon.empty,
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
    <a-col :span="12">
      <a-form-item label="Icon">
        <a-select v-model:value="formState.meta.iconIdx" size="small" class="w-52">
          <a-select-option v-for="(icon, i) of iconList" :key="i" :value="i">
            <component
              :is="getMdiIcon(icon.full)"
              class="mx-1"
              :style="{
                color: formState.meta.color,
              }"
            />
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
        <a-select v-model:value="formState.meta.max" class="w-52" size="small">
          <a-select-option v-for="(v, i) in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" :key="i" :value="v">
            {{ v }}
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
