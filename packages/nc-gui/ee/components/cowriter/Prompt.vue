<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { ListItem as AntListItem } from 'ant-design-vue/lib/list'
import { getWordUntilCaret, useCowriterStoreOrThrow, useDebounceFn } from '#imports'

const { promptStatementTemplate, savePromptStatementTemplate, supportedColumns } = useCowriterStoreOrThrow()

const promptRef = ref()

const autocomplete = ref(false)

const selected = ref(0)

const wordToComplete = ref<string | undefined>('')

const sugOptionsRef = ref<(typeof AntListItem)[]>([])

const syncValue = useDebounceFn(async () => await savePromptStatementTemplate(), 500, { maxWait: 2000 })

const suggestionListVisible = ref(false)

const vModel = computed({
  get: () => promptStatementTemplate.value,
  set: (val) => {
    if (val !== promptStatementTemplate.value) {
      promptStatementTemplate.value = val
      syncValue()
    }
  },
})

const suggestionsList = computed(() => {
  return [
    ...supportedColumns.value
      .filter((c: ColumnType) => {
        // skip system LTAR columns & system columns
        return !(c.uidt === UITypes.LinkToAnotherRecord && c.system)
      })
      .map((c: any) => ({
        text: c.title,
        type: 'column',
        icon: getUIDTIcon(c.uidt),
        uidt: c.uidt,
      })),
  ]
})

// set default suggestion list
const suggestion: Record<string, any> = ref(suggestionsList.value)

const acTree = computed(() => {
  const ref = new NcAutocompleteTree()
  for (const sug of suggestionsList.value) {
    ref.add(sug)
  }
  return ref
})

function getCurlyBracket(isDouble = true) {
  const arr = (isDouble ? promptRef.value.$el.value.match(/{{|}}/g) : promptRef.value.$el.value.match(/{|}/g)) || []
  return arr.reduce((acc: Record<number, number>, cur: number) => {
    acc[cur] = (acc[cur] || 0) + 1
    return acc
  }, {})
}

function isCurlyDoubleBracketBalanced() {
  // count number of double opening curly brackets and closing curly brackets
  const cntCurlyBrackets = getCurlyBracket()
  return (cntCurlyBrackets['{{'] || 0) === (cntCurlyBrackets['}}'] || 0)
}

function isCurlyBracketBalanced() {
  // count number of opening curly brackets and closing curly brackets
  const cntCurlyBrackets = getCurlyBracket(false)
  return (cntCurlyBrackets['{'] || 0) === (cntCurlyBrackets['}'] || 0)
}

function appendText(item: Record<string, any>) {
  const text = item.text
  const len = wordToComplete.value?.length || 0
  let offset = 0
  const lastWord = promptRef.value.$el.value.split(' ').slice(-1).join(' ')
  if (!isCurlyBracketBalanced() || !isCurlyDoubleBracketBalanced()) {
    if (lastWord.includes('{{')) {
      offset = 2
    } else if (lastWord.includes('{')) {
      offset = 1
    }
  } else {
    offset = -len + lastWord.length
  }

  vModel.value = insertAtCursor(promptRef.value.$el, `{{${text}}}`, len + offset)

  autocomplete.value = false
  wordToComplete.value = ''
  // show all options if column is chosen
  suggestion.value = suggestionsList.value
}

const handleInputDeb = useDebounceFn(function () {
  handleInput()
}, 250)

function handleInput() {
  selected.value = 0
  suggestion.value = []
  const query = getWordUntilCaret(promptRef.value.$el)
  const parts = query.split(/\W+/)
  wordToComplete.value = parts.pop() || ''
  suggestion.value = acTree.value.complete(wordToComplete.value)
  if (!isCurlyBracketBalanced()) {
    suggestionListVisible.value = true
    suggestion.value = suggestion.value.filter((v: Record<string, any>) => v.type === 'column')
  } else {
    suggestionListVisible.value = false
  }
  autocomplete.value = !!suggestion.value.length
}

watch(suggestionsList, (v) => {
  suggestion.value = v
})
</script>

<template>
  <div class="w-full nc-cowriter-prompt">
    <a-row>
      <a-col :span="16" class="max-h-[max(calc(100vh_-_200px)_,300px)] overflow-hidden overflow-y-scroll scrollbar-thin-dull">
        <a-textarea
          ref="promptRef"
          v-model:value="vModel"
          :bordered="false"
          :auto-size="{ minRows: 20 }"
          @change="handleInputDeb"
        />
      </a-col>
      <a-col
        :span="8"
        class="max-h-[max(calc(100vh_-_200px)_,300px)] overflow-hidden overflow-y-scroll scrollbar-thin-dull p-4 border-l-1"
      >
        <a-list ref="sugListRef" :data-source="suggestion" :locale="{ emptyText: 'No suggested column was found' }">
          <template #renderItem="{ item, index }">
            <a-list-item
              :ref="
                (el) => {
                  sugOptionsRef[index] = el
                }
              "
              class="cursor-pointer"
              @click.prevent.stop="appendText(item)"
            >
              <a-list-item-meta>
                <template #title>
                  <div class="flex">
                    <a-col :span="6">
                      <span class="prose-sm text-gray-600">{{ item.text }}</span>
                    </a-col>

                    <a-col :span="18">
                      <div v-if="item.type === 'function'" class="text-xs text-gray-500">
                        {{ item.description }} <br /><br />
                        Syntax: <br />
                        {{ item.syntax }} <br /><br />
                        Examples: <br />

                        <div v-for="(example, idx) of item.examples" :key="idx">
                          <div>({{ idx + 1 }}): {{ example }}</div>
                        </div>
                      </div>

                      <div v-if="item.type === 'column'" class="float-right mr-5 -mt-2">
                        <a-badge-ribbon :text="item.uidt" color="gray" />
                      </div>
                    </a-col>
                  </div>
                </template>

                <template #avatar>
                  <component :is="item.icon" class="text-lg" />
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-col>
    </a-row>
  </div>
</template>

<style lang="scss">
.nc-cowriter-prompt textarea {
  @apply !m-[40px];
}
</style>
