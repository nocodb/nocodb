<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { selectSectionsInTextSelection } from '~~/utils/tiptapExtensions/section/helper'

interface SelectionBox {
  left: number
  right: number
  top: number
  bottom: number
  anchorLeft: number
  anchorTop: number
}

interface Props {
  editor: Editor
  pageWrapperDomRef: HTMLElement
  pageContentDomRef: HTMLElement
  selectionBox: SelectionBox | undefined
}

const props = defineProps<Props>()
const emits = defineEmits(['update:selectionBox'])

const { editor, pageWrapperDomRef, pageContentDomRef } = toRefs(props)

const selectionBox = useVModel(props, 'selectionBox', emits)

watchDebounced(
  selectionBox,
  () => {
    if (!selectionBox.value) return

    const { left, right, top, bottom } = selectionBox.value
    const proseMirrorSectionDoms = document.querySelectorAll('.ProseMirror .draggable-block-wrapper')

    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    const domsInsideSelectionBox = Array.from(proseMirrorSectionDoms).filter((dom) => {
      const domRect = dom.getBoundingClientRect()

      const domLeft = domRect.left
      const selectionRight = viewportWidth - right

      // Dom top relative to the page content
      const domTop = domRect.top + pageContentDomRef.value.scrollTop - pageContentDomRef.value.getBoundingClientRect().top
      // Selection bottom relative to the page content
      const selectionBottom = viewportHeight - bottom - pageContentDomRef.value.getBoundingClientRect().top

      const isDomLeftInside = domLeft > left && domLeft < selectionRight
      const isDomRightInside = domLeft + domRect.width > left && domLeft + domRect.width < selectionRight
      const isDomTopInside = domTop > top && domTop < selectionBottom
      const isDomBottomInside = domTop + domRect.height > top && domTop + domRect.height < selectionBottom

      const isInsideSelectionBox = (isDomLeftInside || isDomRightInside) && (isDomTopInside || isDomBottomInside)

      return isInsideSelectionBox
    })

    if (domsInsideSelectionBox.length === 0) {
      return editor.value?.chain().focus().setTextSelection(editor.value.view.state.selection.from).run()
    }

    const firstPos = Number(domsInsideSelectionBox[0]?.getAttribute('pos'))
    const lastPos = Number(domsInsideSelectionBox[domsInsideSelectionBox.length - 1]?.getAttribute('pos'))
    const lastNode = editor.value?.state.doc.nodeAt(lastPos)

    editor.value
      ?.chain()
      .focus()
      .setTextSelection({ from: firstPos, to: lastPos + lastNode!.nodeSize - 1 })
      .run()
  },
  {
    deep: true,
    debounce: 100,
    maxWait: 200,
  },
)

onMounted(() => {
  if (!pageWrapperDomRef.value) return
  const wrapper = pageWrapperDomRef.value

  // Listen to mousedown event
  wrapper.addEventListener('mousedown', async (e) => {
    if (selectionBox.value) return

    // x as relative to the page content
    const x = e.clientX - wrapper.getBoundingClientRect().left
    // y as relative to the page content
    const y = e.clientY + pageContentDomRef.value.scrollTop - pageContentDomRef.value.getBoundingClientRect().top

    // Get doms with absolute position in the event
    const domsInEvent = document.elementsFromPoint(e.clientX, e.clientY)

    if (domsInEvent.some((dom) => dom.classList.contains('ProseMirror'))) return

    e.stopPropagation()
    e.preventDefault()

    editor.value?.chain().setTextSelection(editor.value.view.state.selection.from).run()

    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    selectionBox.value = {
      left: x,
      right: viewportWidth - x,
      top: y,
      bottom: viewportHeight - y,
      anchorLeft: x,
      anchorTop: y,
    }
  })

  // Listen to mousemove event
  wrapper.addEventListener('mousemove', (e) => {
    if (!selectionBox.value) return

    e.stopPropagation()
    e.preventDefault()

    const pageContentTop = pageContentDomRef.value.getBoundingClientRect().top
    const wrapperLeftOffset = wrapper.getBoundingClientRect().left

    const x = e.clientX
    const relativeX = x - pageContentDomRef.value.getBoundingClientRect().left

    const y = e.clientY + pageContentDomRef.value.scrollTop - pageContentTop

    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const pageContentDivBottom = pageContentDomRef.value.clientHeight + pageContentDomRef.value.clientTop

    if (relativeX < selectionBox.value.anchorLeft) {
      selectionBox.value.left = relativeX
    } else {
      selectionBox.value.right = viewportWidth - x
    }

    if (y < selectionBox.value.anchorTop) {
      selectionBox.value.top = y
    } else if (y !== selectionBox.value.top && pageContentDivBottom - y !== selectionBox.value.bottom) {
      selectionBox.value.bottom = pageContentDivBottom - y
    }

    if (x === selectionBox.value.anchorLeft + wrapperLeftOffset && y === selectionBox.value.anchorTop) {
      return
    }

    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    // If add the end of viewport, scroll down
    if (e.clientY > viewportHeight - viewportHeight * 0.2) {
      pageContentDomRef.value.scrollBy(0, 10)
      setTimeout(() => {
        pageContentDomRef.value.scrollBy(0, 5)
      }, 1000)
    }

    // If add the top of viewport, scroll up
    if (e.clientY < pageContentDivBottom * 0.2) {
      pageContentDomRef.value.scrollBy(0, -10)
      setTimeout(() => {
        pageContentDomRef.value.scrollBy(0, -5)
      }, 100)
    }
  })

  // Listen to mouseup event
  wrapper.addEventListener('mouseup', (e) => {
    if (!selectionBox.value) return

    e.stopPropagation()
    e.preventDefault()

    selectionBox.value = undefined
    const selection = editor.value?.state.selection
    if (!selection) return

    setTimeout(() => {
      selectSectionsInTextSelection(editor.value!.state)
    }, 0)
  })
})
</script>

<template>
  <div
    v-if="selectionBox"
    class="absolute bg-primary-selected opacity-55 z-50 rounded-sm"
    :style="{
      left: `${selectionBox?.left}px`,
      top: `${selectionBox?.top}px`,
      right: `${selectionBox?.right}px`,
      bottom: `${selectionBox?.bottom}px`,
    }"
  ></div>
</template>
