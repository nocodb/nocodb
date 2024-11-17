<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const picked = computed({
  get: () => vModel.value.meta.color,
  set: (val) => {
    vModel.value.meta.color = val
  },
})

const isOpenColorPicker = ref(false)

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Rating],
  ...(vModel.value.meta || {}),
  icon: extractRatingIcon(vModel.value.meta || {}),
}

// antdv doesn't support object as value
// use iconIdx as value and update back in watch
const iconIdx = ratingIconList.findIndex(
  (ele) => ele.full === vModel.value.meta.icon.full && ele.empty === vModel.value.meta.icon.empty,
)

vModel.value.meta.iconIdx = iconIdx === -1 ? 0 : iconIdx

watch(
  () => vModel.value.meta.iconIdx,
  (v) => {
    vModel.value.meta.icon = ratingIconList[v]
  },
)
</script>

<template>
  <a-row :gutter="8">
    <a-col :span="8">
      <a-form-item :label="$t('labels.icon')">
        <a-select v-model:value="vModel.meta.iconIdx" class="w-52" dropdown-class-name="nc-dropdown-rating-icon">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(icon, i) of ratingIconList" :key="i" :value="i">
            <div class="flex gap-2 w-full truncate items-center">
              <div class="flex-1 flex items-center text-gray-700 gap-2 children:(h-4 w-4)">
                <component :is="getMdiIcon(icon.full)" />

                <component :is="getMdiIcon(icon.empty)" />
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.meta.iconIdx === i"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
    <a-col :span="8">
      <a-form-item :label="$t('general.colour')">
        <NcDropdown
          v-model:visible="isOpenColorPicker"
          placement="bottom"
          :auto-close="false"
          class="nc-color-picker-dropdown-trigger"
        >
          <div
            class="flex-1 border-1 border-gray-300 rounded-lg h-8 px-[11px] flex items-center justify-between transition-all cursor-pointer"
            :class="{
              'border-brand-500 shadow-selected': isOpenColorPicker,
            }"
          >
            <div class="flex-1 flex items-center gap-2 children:(h-4 w-4)">
              <component
                :is="getMdiIcon(ratingIconList[vModel.meta.iconIdx].full)"
                :style="{
                  color: vModel.meta.color,
                }"
              />
              <component
                :is="getMdiIcon(ratingIconList[vModel.meta.iconIdx].empty)"
                :style="{
                  color: vModel.meta.color,
                }"
              />
            </div>

            <GeneralIcon icon="arrowDown" class="text-gray-700 h-4 w-4" />
          </div>
          <template #overlay>
            <div>
              <LazyGeneralAdvanceColorPicker
                v-model="picked"
                :is-open="isOpenColorPicker"
                @input="(el:string)=>vModel.meta.color=el"
              ></LazyGeneralAdvanceColorPicker>
            </div>
          </template>
        </NcDropdown>
      </a-form-item>
    </a-col>
    <a-col :span="8">
      <a-form-item :label="$t('labels.max')">
        <a-select
          v-model:value="vModel.meta.max"
          data-testid="nc-dropdown-rating-max"
          class="w-52"
          dropdown-class-name="nc-dropdown-rating-color"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(v, i) in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" :key="i" :value="v">
            <div class="flex gap-2 w-full justify-between items-center nc-dropdown-rating-max-option">
              {{ v }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.max === v"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
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
