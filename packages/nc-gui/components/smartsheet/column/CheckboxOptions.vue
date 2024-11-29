<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// cater existing v1 cases
const iconList = checkboxIconList

const picked = computed({
  get: () => vModel.value.meta.color,
  set: (val) => {
    vModel.value.meta.color = val
  },
})

const isOpenColorPicker = ref(false)

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Checkbox],
  ...(vModel.value.meta || {}),
  icon: extractCheckboxIcon(vModel.value.meta || {}),
}

// antdv doesn't support object as value
// use iconIdx as value and update back in watch
const iconIdx = iconList.findIndex(
  (ele) => ele.checked === vModel.value.meta.icon.checked && ele.unchecked === vModel.value.meta.icon.unchecked,
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
    <a-col :span="12">
      <a-form-item :label="$t('labels.icon')">
        <a-select v-model:value="vModel.meta.iconIdx" class="w-52" dropdown-class-name="nc-dropdown-checkbox-icon">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(icon, i) of iconList" :key="i" :value="i">
            <div class="flex gap-2 w-full truncate items-center">
              <div class="flex-1 flex items-center text-gray-700 gap-2 children:(h-4 w-4)">
                <component :is="getMdiIcon(icon.checked)" />
                <component :is="getMdiIcon(icon.unchecked)" />
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
    <a-col :span="12">
      <a-form-item :label="$t('general.colour')">
        <NcDropdown
          v-model:visible="isOpenColorPicker"
          placement="bottomRight"
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
                :is="getMdiIcon(iconList[vModel.meta.iconIdx].checked)"
                :style="{
                  color: vModel.meta.color,
                }"
              />
              <component
                :is="getMdiIcon(iconList[vModel.meta.iconIdx].unchecked)"
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
