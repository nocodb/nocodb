<script lang="ts" setup>
const { modelValue } = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = computed({
  get: () => modelValue,
  set: (v) => emit('update:modelValue', v),
})

const shortcutList = [
  {
    title: 'General',
    shortcuts: [
      {
        keys: [renderCmdOrCtrlKey(), 'K'],
        behaviour: 'Open quick navigation',
      },
      {
        keys: [renderCmdOrCtrlKey(), 'L'],
        behaviour: 'Open recent views',
      },
      {
        keys: [renderCmdOrCtrlKey(), 'J'],
        behaviour: 'Search in docs',
      },
      {
        keys: [renderCmdOrCtrlKey(), '/'],
        behaviour: 'Open keyboard shortcuts',
      },
      {
        keys: [renderAltOrOptlKey(), 'D'],
        behaviour: 'Create new base',
      },
      {
        keys: [renderAltOrOptlKey(), 'T'],
        behaviour: 'Insert new table',
      },
      {
        keys: [renderAltOrOptlKey(), 'C'],
        behaviour: 'Insert new column',
      },
      {
        keys: [renderAltOrOptlKey(), 'R'],
        behaviour: 'Insert new row',
      },
      {
        keys: [renderAltOrOptlKey(), 'I'],
        behaviour: 'Open share modal',
      },
    ],
  },
  {
    title: 'Grid View',
    shortcuts: [
      {
        keys: ['←', '→', '↑', '↓'],
        behaviour: 'General cell navigation',
      },
      {
        keys: ['Tab'],
        behaviour: 'Move to next cell horizontally; if on last cell, move to next row beginning',
      },
      {
        keys: [renderCmdOrCtrlKey(), '←'],
        behaviour: 'Jump to leftmost column in this row',
      },
      {
        keys: [renderCmdOrCtrlKey(), '→'],
        behaviour: 'Jump to rightmost column in this row',
      },
      {
        keys: [renderCmdOrCtrlKey(), '↑'],
        behaviour: 'Jump to first record in this column (in same page)',
      },
      {
        keys: [renderCmdOrCtrlKey(), '↓'],
        behaviour: 'Jump to last record in this column (in same page)',
      },
      {
        keys: ['Enter'],
        behaviour: 'Switch cell in focus to EDIT mode; opens modal / picker if cell is associated with one',
      },
      {
        keys: ['Esc'],
        behaviour: 'Exit cell EDIT mode',
      },
      {
        keys: ['Space'],
        behaviour: 'Expand current row',
      },
      {
        keys: [renderCmdOrCtrlKey(), 'C'],
        behaviour: 'Copy cell contents',
      },
      {
        keys: ['Delete'],
        behaviour: 'Clear cell',
      },
    ],
  },
  {
    title: 'Expanded Form',
    shortcuts: [
      {
        keys: [renderAltOrOptlKey(), 'S'],
        behaviour: 'Save current expanded form item',
      },
      {
        keys: [renderAltOrOptlKey(), 'N'],
        behaviour: 'Create a new row',
      },
      {
        keys: [renderAltOrOptlKey(), '←'],
        behaviour: 'Switch to previous row',
      },
      {
        keys: [renderAltOrOptlKey(), '→'],
        behaviour: 'Switch to next row',
      },
    ],
  },
  {
    title: 'Text / Number',
    shortcuts: [
      {
        keys: ['←'],
        behaviour: 'Move cursor to the left',
      },
      {
        keys: ['→'],
        behaviour: 'Move cursor to the right',
      },
      {
        keys: ['↑'],
        behaviour: 'Move cursor to the left',
      },
      {
        keys: ['↓'],
        behaviour: 'Move cursor to the right',
      },
    ],
  },
  {
    title: 'Single Select',
    shortcuts: [
      {
        keys: ['↑'],
        behaviour: 'Move to the previous option',
      },
      {
        keys: ['↓'],
        behaviour: 'Move to the next option',
      },
      {
        keys: ['Enter'],
        behaviour: 'Select the current option',
      },
    ],
  },
  {
    title: 'Multi Select',
    shortcuts: [
      {
        keys: ['↑'],
        behaviour: 'Move to the previous option',
      },
      {
        keys: ['↓'],
        behaviour: 'Move to the next option',
      },
      {
        keys: ['Enter'],
        behaviour: 'Select / deselect the current option',
      },
    ],
  },
  {
    title: 'Link To Another Record',
    shortcuts: [
      {
        keys: ['Tab'],
        behaviour: 'Move to the next option',
      },
      {
        keys: ['Shift', 'Tab'],
        behaviour: 'Move to the previous option',
      },
      {
        keys: ['Enter'],
        behaviour: 'Select the current option',
      },
    ],
  },
  {
    title: 'Checkbox',
    shortcuts: [
      {
        keys: ['Enter'],
        behaviour: 'Toggle',
      },
    ],
  },
  {
    title: 'Rating',
    shortcuts: [
      {
        keys: ['<0 ~ Max>'],
        behaviour: 'Enter number to toggle rating',
      },
    ],
  },
]
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    size="lg"
    width="min(calc(100vw - 32px), 540px)"
    :show-separator="false"
    wrap-class-name="nc-modal-keyboard-shortcuts"
  >
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="p-2 w-full flex items-center gap-2 border-b-1 border-nc-border-gray-medium flex-none">
        <GeneralIcon icon="ncKeyboard" class="text-xl text-nc-content-gray-subtle ml-1" />
        <h3 class="flex-1 text-base font-semibold text-nc-content-gray m-0 rtl:text-right">
          {{ $t('title.keyboardShortcut') }}
        </h3>
        <NcButton size="small" type="text" @click="dialogShow = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4">
        <div v-for="(section, sectionIdx) of shortcutList" :key="sectionIdx" class="mb-4 last:mb-0">
          <div class="text-bodyBold font-semibold text-nc-content-gray-subtle mb-2 tracking-wide rtl:text-right">
            {{ section.title }}
          </div>
          <div class="flex flex-col rounded-lg border-1 border-nc-border-gray-medium overflow-hidden">
            <div
              v-for="(item, itemIdx) of section.shortcuts"
              :key="itemIdx"
              class="flex items-center justify-between py-2 px-3 gap-4"
              :class="{ 'border-t-1 border-nc-border-gray-light': itemIdx > 0 }"
            >
              <span class="text-bodyDefaultSm text-nc-content-gray-subtle2">
                {{ item.behaviour }}
              </span>
              <span class="flex items-center gap-1 flex-none">
                <kbd v-for="(key, keyIdx) of item.keys" :key="keyIdx" class="nc-kbd">
                  {{ key }}
                </kbd>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-keyboard-shortcuts {
  .nc-modal {
    @apply !p-0;
  }
}
</style>

<style lang="scss" scoped>
.nc-kbd {
  @apply inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-[12px] font-medium leading-none text-nc-content-gray-subtle bg-nc-bg-gray-light border-1 border-nc-border-gray-medium border-b-2 rounded-md;
}
</style>
