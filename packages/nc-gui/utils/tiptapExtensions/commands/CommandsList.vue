<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { useCommandList } from './utils'
import { getEmbedContentType, urlToEmbedUrl } from '~/utils/tiptapExtensions/embed/urlHelper'

interface Props {
  command: Function
  editor: Editor
  query: string
}

const { command, query, editor } = defineProps<Props>()

const linkOptions = ref({
  title: '',
  url: '',
  type: '',
  isErrored: false,
  isVisible: false,
})
const linkInputRef = ref()
const fileInput = ref()
const loadingOpType = ref('')

const { commands } = useCommandList({
  fileInputDomRef: fileInput,
  linkOptions,
  loadingOpType,
})

const selectedIndex = ref(0)

const insertLink = () => {
  linkOptions.value.isErrored = false
  // validate link
  if (!isValidURL(linkOptions.value.url)) {
    linkOptions.value.isErrored = true
    return
  }

  if (linkOptions.value.type !== 'embed' && getEmbedContentType(linkOptions.value.url) !== linkOptions.value.type) {
    linkOptions.value.isErrored = true
    return
  }

  editor
    .chain()
    .focus()
    .deleteActiveSection()
    .setEmbed({
      url: urlToEmbedUrl(linkOptions.value.url),
      type: getEmbedContentType(linkOptions.value.type)!,
    })
    .selectActiveSectionFirstChild()
    .run()
  linkOptions.value.isVisible = false
}

const filterItems = computed(() => {
  return commands.value.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
})

const onFilePicked = (event: any) => {
  const selectedNodeType = filterItems.value[selectedIndex.value]
  const files = event.target.files

  if (selectedNodeType.title === 'Image') {
    editor.chain().focus().deleteActiveSection().setImage(files).run()
  } else if (selectedNodeType.title === 'Attachment') {
    editor.chain().focus().deleteActiveSection().setAttachment(files).run()
  }
}

const selectItem = (title: string) => {
  const index = commands.value.findIndex((item) => item.title === title)
  command(commands.value[index])
}

const scrollToSelectedNode = () => {
  const dom = document.querySelector(`.items .item:nth-child(${selectedIndex.value + 1})`)
  const wrapperDom = document.querySelector(`.items`)

  const dividerCount =
    filterItems.value.length === commands.value.length
      ? filterItems.value.slice(0, selectedIndex.value).filter((item) => item.hasDivider).length
      : 0

  const remInPixels = Number(getComputedStyle(document.documentElement).fontSize.replace('px', ''))

  if (dom && wrapperDom) {
    // todo: Hack. Find a better way to calculate the offset
    wrapperDom.scrollTop =
      (dom as any).offsetTop -
      (wrapperDom as any).offsetHeight +
      (dom.clientHeight - remInPixels) * selectedIndex.value +
      (remInPixels / 4) * dividerCount
  }
}

const upHandler = () => {
  selectedIndex.value = (selectedIndex.value + commands.value.length - 1) % commands.value.length
  scrollToSelectedNode()
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % commands.value.length
  scrollToSelectedNode()
}

const onHover = (index: number) => {
  selectedIndex.value = index
}

const enterHandler = () => {
  const item = filterItems.value[selectedIndex.value]
  selectItem(item.title)
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    return true
  }

  return false
}

watch(
  () => query,
  () => {
    selectedIndex.value = 0
  },
)

watch(linkInputRef, (value) => {
  if (value) {
    value.focus()
  }
})

watch(
  () => linkOptions.value.url,
  () => {
    linkOptions.value.isErrored = false
  },
)

watch(
  () => linkOptions.value.isVisible,
  () => {
    if (!linkOptions.value.isVisible) {
      linkOptions.value.url = ''
      linkOptions.value.isVisible = false
    }
  },
)

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div class="items nc-docs-command-list">
    <template v-if="linkOptions.isVisible">
      <div class="flex flex-col w-56 mx-1 mt-1 mb-1">
        <div
          class="w-8 rounded-md my-1 p-1 pl-2 cursor-pointer hover:bg-gray-200"
          data-testid="nc-docs-command-list-link-back-btn"
          @click="linkOptions.isVisible = false"
        >
          <MdiArrowLeft />
        </div>
        <input
          ref="linkInputRef"
          v-model="linkOptions.url"
          class="w-full my-1 py-1 px-2 border-0 bg-gray-100 text-sm rounded-md focus:outline-none !focus:shadow-none !focus:ring-warmGray-50"
          type="text"
          placeholder="Enter link"
          data-testid="nc-docs-command-list-link-input"
          @keydown.enter="insertLink"
          @keydown.escape="linkOptions.isVisible = false"
        />
        <div
          v-if="linkOptions.isErrored"
          class="flex flex-row pl-1.5 pr-1 pb-1 text-xs text-red-500"
          data-testid="nc-docs-command-list-link-input-error"
        >
          Given
          <span v-if="linkOptions.type !== 'embed'" class="capitalize px-1">{{ linkOptions.type }}</span>
          link is not valid
        </div>
      </div>
    </template>
    <template v-else-if="filterItems.length">
      <template v-for="(item, index) in filterItems" :key="item.title">
        <a-button
          class="item !flex !flex-row !items-center"
          :class="{
            'is-selected': index === selectedIndex,
            '!hover:bg-inherit !cursor-not-allowed': loadingOpType === item.title,
          }"
          type="text"
          :loading="loadingOpType === item.title"
          :data-testid="`nc-docs-command-list-item-${item.title}`"
          @click="selectItem(item.title)"
          @mouseenter="() => onHover(index)"
        >
          <input
            v-if="item.title === 'Image' || item.title === 'Attachment'"
            ref="fileInput"
            type="file"
            style="display: none"
            :accept="item.title === 'Image' ? 'image/*' : '*'"
            @change="onFilePicked"
          />
          <div class="flex flex-row items-center justify-between w-full">
            <div class="flex items-center gap-x-1.5">
              <component :is="item.icon" v-if="item.icon && loadingOpType !== item.title" :class="item.iconClass" />
              <div :class="item.class" :style="item.style">
                {{ item.title }}
              </div>
            </div>
            <div class="flex text-gray-400 items-center">
              {{ item.shortCutText }}
            </div>
          </div>
        </a-button>
        <div v-if="item.hasDivider && filterItems.length === commands.length" class="divider"></div>
      </template>
    </template>
    <div v-else class="item">No result</div>
  </div>
</template>

<style lang="scss" scoped>
.items {
  @apply px-1 my-0.5 w-60;
  position: relative;
  border-radius: 0.5rem;
  color: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-size: 0.9rem;
  @apply bg-gray-50;
  max-height: 16rem;
  overflow-y: overlay;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 1px 1px rgba(0, 0, 0, 0.1);
}

.divider {
  width: 90%;
  @apply border-t border-gray-200 ml-1.5 !my-2;
}

.item {
  display: block;
  margin: 0;
  width: 100%;
  text-align: left;
  background: transparent;
  border-radius: 0.4rem;
  border: 1px solid transparent;
  padding: 0.3rem 0.75rem;
  margin: 0.2rem 0;
  @apply !transition-none;

  &.is-selected {
    @apply border-gray-200 !bg-gray-100;
  }
}

.items {
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 2px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    @apply my-2;
    background: #f6f6f600 !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: rgb(215, 215, 215);
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(203, 203, 203);
  }
}
</style>
