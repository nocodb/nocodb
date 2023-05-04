<script lang="ts" setup>
// Manages the subheading list shown in the Page view.
// Subheadings are extracted from the page content and active subheading is highlighted (the  that is currently in view)

const { wrapperRef } = defineProps<{
  wrapperRef: HTMLDivElement | undefined
}>()

const { openedPage } = storeToRefs(useDocStore())

const pageSubHeadings = ref<Array<{ type: string; text: string; active: boolean }>>([])
// As there is a delay in the page content being rendered, we need to not show 'no content' message
// when the page is being populated for the first time
const isFirstTimePopulatingSubHeadings = ref(true)

let lastPageScrollTime = 0

// Highlight the active subheading
const selectActiveSubHeading = (event?: Event) => {
  if (pageSubHeadings.value.length === 0) return

  if (Date.now() - lastPageScrollTime < 10 && event?.type === 'scroll') return
  lastPageScrollTime = Date.now()

  const _subHeadingDoms = document.querySelectorAll('.ProseMirror [data-tiptap-heading]')
  const subHeadingDomsWithIndex = [..._subHeadingDoms].map((dom, index) => ({ dom, index }))

  const subHeadingsThatCouldBeActive = [...subHeadingDomsWithIndex]
    // Filter out subheadings which are below the viewport
    .filter(({ dom }) => {
      const subHeadingDomRect = (dom as HTMLElement).getBoundingClientRect()
      return subHeadingDomRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) / 3
    })

    // So we have the subheadings which are above the top header and nearest to the viewport
    .sort((a, b) => a.dom.getBoundingClientRect().top - b.dom.getBoundingClientRect().top)

  const activeHeading = subHeadingsThatCouldBeActive[subHeadingsThatCouldBeActive.length - 1]

  const newSubheadings = pageSubHeadings.value.map((subHeading, index) => {
    const newSubheading = { ...subHeading }
    newSubheading.active = activeHeading && activeHeading.index === index
    return newSubheading
  })

  const noPageActive = newSubheadings.every((subHeading) => !subHeading.active)
  if (!noPageActive) {
    pageSubHeadings.value = newSubheadings
  }
}

// Extract subheadings from the page content and populate the subheading list
const populatedPageSubheadings = () => {
  const subHeadingDoms = document.querySelectorAll('.ProseMirror [data-tiptap-heading]')

  pageSubHeadings.value = []
  for (let i = 0; i < subHeadingDoms.length; i++) {
    const headingDom = subHeadingDoms[i] as HTMLElement
    pageSubHeadings.value.push({
      type: headingDom.nodeName.toLowerCase(),
      text: headingDom.innerText,
      active: i === 0,
    })
  }
}

// Poll the page content until it is rendered, as the subheadings are extracted from the page dom content
const pollPageRendered = async () => {
  const _poll = () => document.querySelector('.ProseMirror')

  const _pollWithDelay = async () => {
    if (_poll()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  while (!_poll()) {
    await _pollWithDelay()
  }

  isFirstTimePopulatingSubHeadings.value = true
  populatedPageSubheadings()
  isFirstTimePopulatingSubHeadings.value = false
}

// Select the active subheading when the page/parent wrapper is scrolled
watch(
  () => wrapperRef,
  () => {
    if (wrapperRef) {
      wrapperRef.addEventListener('scroll', selectActiveSubHeading)
      wrapperRef.addEventListener('resize', selectActiveSubHeading)
    }
  },
  {
    immediate: true,
  },
)

watch(
  () => openedPage.value?.content,
  () => {
    populatedPageSubheadings()
    selectActiveSubHeading()
  },
)

onMounted(() => {
  pollPageRendered()
})
</script>

<template>
  <div
    class="absolute top-10 right-2 pt-20 flex flex-col w-full mr-12 overflow-hidden sm:w-0 md:w-0 lg:w-24 xl:w-36 2xl:w-54"
    data-testid="docs-page-outline-content"
    :style="{
      transition: 'opacity 0.2s ease-in-out',
    }"
  >
    <div class="mb-2 text-gray-400 text-xs font-semibold pop-in-animation-med-delay">Content</div>
    <div v-if="!isFirstTimePopulatingSubHeadings && pageSubHeadings.length === 0" class="pop-in-animation-med-delay">
      No content
    </div>
    <a
      v-for="(subHeading, index) in pageSubHeadings"
      :key="index"
      :href="`#${subHeading.text}`"
      class="flex py-1 !hover:text-primary !underline-transparent max-w-full break-all pop-in-animation-med-delay"
      :data-testid="`docs-page-outline-subheading-${index}`"
      :class="{
        'font-semibold text-primary': subHeading.active,
        '!text-gray-700': !subHeading.active,
        'ml-2.5': subHeading.type === 'h2',
        'ml-5': subHeading.type === 'h3',
      }"
      :aria-current="subHeading.active ? 'page' : undefined"
      :aria-level="subHeading.type[1]"
    >
      {{ subHeading.text }}
    </a>
  </div>
</template>
