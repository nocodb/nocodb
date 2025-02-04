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
        keys: ['ALT', 'T'],
        behaviour: 'Insert new table',
      },
      {
        keys: ['ALT', 'R'],
        behaviour: 'Insert new row',
      },
      {
        keys: ['ALT', 'C'],
        behaviour: 'Insert new column',
      },
      {
        keys: ['ALT', 'F'],
        behaviour: 'Toggle fullscreen mode',
      },
      {
        keys: ['ALT', 'I'],
        behaviour: 'Invite a member to team',
      },
      {
        keys: ['ALT', ','],
        behaviour: 'Open Team & Settings',
      },
    ],
  },
  {
    title: 'Grid View',
    shortcuts: [
      {
        keys: [renderAltOrOptlKey(), '←'],
        behaviour: 'Jump to previous page in this view',
      },
      {
        keys: [renderAltOrOptlKey(), '→'],
        behaviour: 'Jump to next page in this view',
      },
      {
        keys: [renderAltOrOptlKey(), '↑'],
        behaviour: 'Jump to last page in this view',
      },
      {
        keys: [renderAltOrOptlKey(), '↓'],
        behaviour: 'Jump to first page in this view',
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
        keys: [renderCmdOrCtrlKey(), 'C'],
        behaviour: 'Copy cell contents',
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
        keys: ['Delete'],
        behaviour: 'Clear cell',
      },
      {
        keys: ['Space'],
        behaviour: 'Expand current row',
      },
      {
        keys: ['←', '→', '↑', '↓'],
        behaviour: 'General cell navigation',
      },
      {
        keys: ['Tab'],
        behaviour: 'Move to next cell horizontally; if on last cell, move to next row beginning',
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
    title: 'SingleSelect',
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
    title: 'MultiSelect',
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
    title: 'Date / DateTime',
    shortcuts: [
      {
        keys: [renderCmdOrCtrlKey(), ';'],
        behaviour: 'Select current date time',
      },
    ],
  },
  {
    title: 'LinkToAnotherRecord',
    shortcuts: [
      {
        keys: ['↑'],
        behaviour: 'Move to the previous option',
      },
      {
        keys: ['↓'],
        behaviour: 'Move to the next option',
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
  {
    title: 'Expanded Form',
    shortcuts: [
      {
        keys: [renderCmdOrCtrlKey(), 'Enter'],
        behaviour: 'Save current expanded form item',
      },
      {
        keys: [renderAltOrOptlKey(), '→'],
        behaviour: 'Switch to next row',
      },
      {
        keys: [renderAltOrOptlKey(), '←'],
        behaviour: 'Switch to previous row',
      },
      {
        keys: [renderAltOrOptlKey(), 'S'],
        behaviour: 'Save current expanded form item',
      },
      {
        keys: [renderAltOrOptlKey(), 'N'],
        behaviour: 'Create a new row',
      },
    ],
  },
]
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    class="p-2"
    :footer="null"
    :wrap-class-name="`nc-modal-keyboard-shortcuts ${dialogShow ? 'active' : ''}`"
    @keydown.esc="dialogShow = false"
  >
    <template #title> {{ $t('title.keyboardShortcut') }} </template>
    <a-list
      v-for="(shortcutItem, shortcutItemIdx) of shortcutList"
      :key="shortcutItemIdx"
      class="nc-shortcut-list !mb-5"
      size="small"
      bordered
      :data-source="shortcutItem.shortcuts"
    >
      <template #header>
        <div class="font-bold">{{ shortcutItem.title }}</div>
      </template>
      <template #renderItem="{ item }">
        <a-list-item>
          <span class="inline-block">
            <kbd
              v-for="(key, keyIdx) of item.keys"
              :key="keyIdx"
              class="ml-[1px] mr-[1px] px-[8px] py-[3px] border-b-[3px] uppercase border-1 border-solid border-primary border-opacity-50 rounded"
            >
              {{ key }}
            </kbd>
          </span>
          <span class="inline-block text-right">
            {{ item.behaviour }}
          </span>
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>
