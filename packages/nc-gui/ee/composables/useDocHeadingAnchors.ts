/**
 * Hash-based anchor routing for document headings.
 *
 * - Scrolls to heading on page load when URL contains a hash fragment
 * - Scrolls to heading when the hash changes during navigation
 * - Handles click on anchor icons (`.nc-heading-anchor-icon`) to copy
 *   the heading's permalink to the clipboard
 * - Surfaces a reactive heading model (`headings`) + the scroll-focused
 *   heading (`activeHeadingId`) that powers the gutter marker rail
 *   (`DocHeadingRail.vue`)
 */
import type { ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { slugifyHeading } from '../components/doc/DocHeadingAnchorExtension'

const STICKY_HEADER_CLASS = 'nc-doc-sticky-header'

/** Heading levels that get a marker on the rail. Matches DocHeadingAnchorExtension. */
const RAIL_HEADING_LEVELS = [1, 2, 3]

export interface DocHeadingEntry {
  id: string
  level: number
  text: string
}

export function useDocHeadingAnchors(
  editor: ShallowRef<Editor | undefined>,
  scrollContainerRef: Ref<HTMLElement | null>,
  isLoaded: Ref<boolean>,
) {
  const route = useRoute()
  const { t } = useI18n()

  // --- Reactive heading model (drives the gutter marker rail) ---

  const headings = ref<DocHeadingEntry[]>([])

  /** The heading currently in view (scroll-spy). Drives the black/active marker. */
  const activeHeadingId = ref<string | null>(null)

  /**
   * Walk the doc and rebuild the heading list. Mirrors the slug + dedup logic
   * in DocHeadingAnchorExtension so the ids line up 1:1 with the rendered
   * `data-heading-anchor` attributes (and therefore with `scrollToHeading`).
   */
  function buildHeadings() {
    const ed = editor.value
    if (!ed) {
      headings.value = []
      return
    }

    const list: DocHeadingEntry[] = []
    const slugCounts = new Map<string, number>()

    ed.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return

      const text = node.textContent.trim()
      if (!text) return

      // Keep slug counting consistent with the anchor extension, which counts
      // every non-empty heading regardless of level — so suffixes stay aligned.
      const baseSlug = slugifyHeading(text)
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`

      const level = node.attrs.level as number
      if (!RAIL_HEADING_LEVELS.includes(level)) return

      list.push({ id: slug, level, text })
    })

    headings.value = list
  }

  const rebuildHeadings = useDebounceFn(buildHeadings, 150)

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

  // --- Scroll-spy: track the heading currently in view ---

  /**
   * The active heading is the last one whose top edge has crossed the trigger
   * line (just below the sticky header). When scrolled above the first heading
   * we fall back to that first heading so the rail always has an anchor.
   */
  function updateActiveHeading() {
    const container = scrollContainerRef.value
    if (!container) return

    const ids = new Set(headings.value.map((h) => h.id))
    if (!ids.size) {
      activeHeadingId.value = null
      return
    }

    const triggerLine = getStickyOffset() + 24
    const containerTop = container.getBoundingClientRect().top
    const els = container.querySelectorAll<HTMLElement>('[data-heading-anchor]')

    let current: string | null = null
    let firstId: string | null = null

    for (const el of els) {
      const id = el.getAttribute('data-heading-anchor')
      if (!id || !ids.has(id)) continue

      if (firstId === null) firstId = id

      const top = el.getBoundingClientRect().top - containerTop
      if (top - triggerLine <= 0) {
        current = id
      } else {
        break
      }
    }

    activeHeadingId.value = current ?? firstId
  }

  let spyRafId: number | null = null
  function onContainerScroll() {
    if (spyRafId != null) return
    spyRafId = requestAnimationFrame(() => {
      spyRafId = null
      updateActiveHeading()
    })
  }

  // Rebuild the heading list whenever the editor's document changes, and keep
  // the scroll-spy listener bound to the live scroll container.
  watch(
    editor,
    (ed, _, onCleanup) => {
      if (!ed) return
      const onTr = () => rebuildHeadings()
      ed.on('update', onTr)
      ed.on('create', onTr)
      buildHeadings()
      onCleanup(() => {
        ed.off('update', onTr)
        ed.off('create', onTr)
      })
    },
    { immediate: true },
  )

  watch(
    scrollContainerRef,
    (el, _, onCleanup) => {
      if (!el) return
      el.addEventListener('scroll', onContainerScroll, { passive: true })
      onCleanup(() => el.removeEventListener('scroll', onContainerScroll))
    },
    { immediate: true },
  )

  // Recompute the active marker after the headings or doc-loaded state settle
  // (content height changes shift every heading's offset).
  watch([headings, isLoaded], () => {
    nextTick(() => updateActiveHeading())
  })

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
    headings,
    activeHeadingId,
  }
}
