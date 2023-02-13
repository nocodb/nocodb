// Manages the subheading list shown in the Page view.
// Subheadings are extracted from the page content and active subheading is highlighted (the  that is currently in view)

const useSubheading = () => {
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const showPageSubHeadings = ref(isPublic.value)
  const pageSubHeadings = ref<Array<{ type: string; text: string; active: boolean }>>([])
  let lastPageScrollTime = 0
  let topHeaderHeight = 60

  // Highlight the active subheading
  const selectActiveSubHeading = () => {
    if (pageSubHeadings.value.length === 0) return

    if (Date.now() - lastPageScrollTime < 100) return
    lastPageScrollTime = Date.now()

    const subHeadingDoms = document.querySelectorAll('.ProseMirror [data-tiptap-heading]')

    const subHeadingsThatCouldBeActive = [...subHeadingDoms]
      // Filter out subheadings which are below the viewport
      .filter((h) => {
        const subHeadingDomRect = (h as HTMLElement).getBoundingClientRect()
        return subHeadingDomRect.top < window.innerHeight
      })

      // Filter out the subheadings which are below the top header(nocohub topbar) within 30px below it
      .filter((h) => (h as HTMLElement).getBoundingClientRect().top - topHeaderHeight - 30 < 0)

      // So we have the subheadings which are above the top header and nearest to the viewport
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)

    const activeHeading = subHeadingsThatCouldBeActive[subHeadingsThatCouldBeActive.length - 1] as HTMLElement

    pageSubHeadings.value = pageSubHeadings.value.map((subHeading) => {
      subHeading.active =
        subHeading.text === activeHeading?.innerText && subHeading.type === activeHeading?.nodeName.toLowerCase()
      return subHeading
    })

    const noPageActive = pageSubHeadings.value.every((subHeading) => !subHeading.active)
    if (noPageActive) {
      pageSubHeadings.value[0].active = true
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

    populatedPageSubheadings()
  }

  onMounted(() => {
    topHeaderHeight = document.querySelector('.nc-header-content')?.clientHeight || 0
    pollPageRendered()
  })

  return {
    showPageSubHeadings,
    pageSubHeadings,
    selectActiveSubHeading,
    populatedPageSubheadings,
  }
}

export { useSubheading }
