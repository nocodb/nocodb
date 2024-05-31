<script setup lang="ts">
const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

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

const picked = computed({
  get: () => vModel.value.meta.color,
  set: (val) => {
    vModel.value.meta.color = val
  },
})

const isOpenColorPicker = ref(false)

// set default value
vModel.value.meta = {
  iconIdx: 0,
  icon: {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  color: '#fcb401',
  max: 5,
  ...vModel.value.meta,
}

// antdv doesn't support object as value
// use iconIdx as value and update back in watch
const iconIdx = iconList.findIndex(
  (ele) => ele.full === vModel.value.meta.icon.full && ele.empty === vModel.value.meta.icon.empty,
)

vModel.value.meta.iconIdx = iconIdx === -1 ? 0 : iconIdx

watch(
  () => vModel.value.meta.iconIdx,
  (v) => {
    vModel.value.meta.icon = iconList[v]
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

          <a-select-option v-for="(icon, i) of iconList" :key="i" :value="i">
            <div class="flex gap-2 w-full truncate items-center">
              <div class="flex-1 text-gray-700">
                <component :is="getMdiIcon(icon.full)" class="mr-1" />

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
          placement="bottom"
          :auto-close="false"
          v-model:visible="isOpenColorPicker"
          class="nc-color-picker-dropdown-trigger"
        >
          <div
            class="flex-1 border-1 border-gray-300 rounded-lg h-8 px-[11px] flex items-center justify-between transition-all cursor-pointer"
            :class="{
              'border-brand-500 shadow-selected': isOpenColorPicker,
            }"
          >
            <div class="flex items-center">
              <component
                :is="getMdiIcon(iconList[vModel.meta.iconIdx].full)"
                class="mr-1"
                :style="{
                  color: vModel.meta.color,
                }"
              />
              <component
                :is="getMdiIcon(iconList[vModel.meta.iconIdx].empty)"
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
                @input="(el:string)=>vModel.meta.color=el"
              ></LazyGeneralAdvanceColorPicker>
            </div>
          </template>
        </NcDropdown>
      </a-form-item>
    </a-col>
    <a-col :span="8">
      <a-form-item :label="$t('labels.max')">
        <a-select v-model:value="vModel.meta.max" class="w-52" dropdown-class-name="nc-dropdown-rating-color">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(v, i) in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" :key="i" :value="v">
            <div class="flex gap-2 w-full justify-between items-center">
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
