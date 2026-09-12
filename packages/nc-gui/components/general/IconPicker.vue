<script setup lang="ts">
import { searchIcons } from '~/utils/iconUtils'

interface Props {
  modelValue?: string | null
  readonly?: boolean
  /** When false, clicking the trigger slot does nothing — the picker only opens programmatically (via expose.open). */
  openOnTriggerClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  readonly: false,
  openOnTriggerClick: true,
})

const emits = defineEmits<{
  'update:modelValue': [icon: string | null]
}>()

const vModel = useVModel(props, 'modelValue', emits)

const isDropdownOpen = ref(false)

const iconSearchQuery = ref('')

const icons = computed(() => {
  return searchIcons(iconSearchQuery.value)
})

function removeIcon() {
  vModel.value = null
  isDropdownOpen.value = false
}

function selectIcon(icon: string) {
  vModel.value = icon
  isDropdownOpen.value = false
}

defineExpose({
  open: () => {
    if (props.readonly) return
    isDropdownOpen.value = true
  },
})
</script>

<template>
  <NcDropdown
    v-model:visible="isDropdownOpen"
    :disabled="readonly"
    :trigger="openOnTriggerClick ? ['click'] : []"
    class="nc-icon-picker-dropdown-trigger"
  >
    <slot :is-open="isDropdownOpen" :icon="vModel" />

    <template #overlay>
      <div class="bg-nc-bg-default w-80 space-y-3 h-70 overflow-y-auto rounded-lg">
        <div class="!sticky top-0 flex gap-2 bg-nc-bg-default px-2 py-2">
          <a-input
            v-model:value="iconSearchQuery"
            :placeholder="$t('placeholder.searchIcons')"
            class="nc-dropdown-search-unified-input z-10 nc-input-shadow"
          >
            <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template>
          </a-input>
          <NcButton size="small" class="!px-4" type="text" @click="removeIcon">
            <span class="text-[13px]">
              {{ $t('general.remove') }}
            </span>
          </NcButton>
        </div>

        <div class="grid px-3 auto-rows-max pb-2 nc-scrollbar-md gap-3 grid-cols-10">
          <component
            :is="icon"
            v-for="({ icon, name }, i) in icons"
            :key="i"
            :icon="icon"
            class="w-6 hover:bg-nc-bg-gray-light cursor-pointer rounded p-1 text-nc-content-gray-subtle h-6"
            @click="selectIcon(name)"
          />
        </div>
      </div>
    </template>
  </NcDropdown>
</template>
