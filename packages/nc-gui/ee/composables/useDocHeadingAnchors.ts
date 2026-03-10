/**
 * Hash-based anchor routing for document headings.
 *
 * - Scrolls to heading on page load when URL contains a hash fragment
 * - Scrolls to heading when the hash changes during navigation
 * - Handles click on anchor icons (`.nc-heading-anchor-icon`) to copy
 *   the heading's permalink to the clipboard
 */
import type { ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const STICKY_HEADER_CLASS = 'nc-doc-sticky-header'

export function useDocHeadingAnchors(
  editor: ShallowRef<Editor | undefined>,
  scrollContainerRef: Ref<HTMLElement | null>,
  isLoaded: Ref<boolean>,
) {
  const route = useRoute()
  const { t } = useI18n()

  /** Measure the sticky header area height so the scroll offset stays accurate. */
  function getStickyOffset(): number {
    const editorWrapper = scrollContainerRef.value?.closest('.nc-doc-editor')

    // The breadcrumb + page-actions bar is always visible at the top (absolute, z-20),
    // even when the sticky header background is not rendered. Use it as the primary
    // measurement so headings never scroll behind the topbar overlay.
    const topbar = editorWrapper?.querySelector('.nc-doc-page-menu-left') as HTMLElement | null
    if (topbar) return topbar.offsetHeight + 8

    const header = editorWrapper?.querySelector(`.${STICKY_HEADER_CLASS}`) as HTMLElement | null
    if (!header) return 16 // small padding when header is not visible
    return header.offsetHeight + 8
  }

  function scrollToHeading(headingId: string): boolean {
    const container = scrollContainerRef.value
    if (!container) return false

    const el = container.querySelector(`[data-heading-anchor="${CSS.escape(headingId)}"]`) as HTMLElement | null
    if (!el) return false

    const elTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top: elTop - getStickyOffset(), behavior: 'smooth' })
    return true
  }

  // Scroll to heading referenced by the current URL hash
  function handleHash() {
    const hash = route.hash?.slice(1)
    if (!hash) return

    // Delay to ensure editor content + decorations are rendered
    nextTick(() => {
      requestAnimationFrame(() => {
        scrollToHeading(hash)
      })
    })
  }

  // Watch for hash changes during in-page navigation
  watch(
    () => route.hash,
    (newHash) => {
      if (newHash) handleHash()
    },
  )

  // Handle initial hash once doc content is loaded
  watch(
    isLoaded,
    (loaded) => {
      if (loaded && route.hash) {
        handleHash()
      }
    },
    { immediate: true },
  )

  // Copy heading permalink to clipboard
  async function copyHeadingLink(headingId: string) {
    const url = new URL(window.location.href)
    url.hash = headingId
    try {
      await navigator.clipboard.writeText(url.toString())
      message.toast(t('activity.copiedLink'))
    } catch {
      // Fallback: set hash so user can copy from address bar
      window.location.hash = headingId
    }
  }

  // Click handler for anchor icon buttons inside headings
  function onAnchorIconClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target?.classList.contains('nc-heading-anchor-icon')) return

    e.preventDefault()
    e.stopPropagation()

    const anchorId = target.getAttribute('data-nc-anchor-id')
    if (anchorId) copyHeadingLink(anchorId)
  }

  // Attach click listener to scroll container
  watch(
    scrollContainerRef,
    (el, _, onCleanup) => {
      if (!el) return
      el.addEventListener('click', onAnchorIconClick, true)
      onCleanup(() => el.removeEventListener('click', onAnchorIconClick, true))
    },
    { immediate: true },
  )

  return {
    scrollToHeading,
    copyHeadingLink,
  }
}
