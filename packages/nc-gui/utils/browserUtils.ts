import type { Editor } from '@tiptap/vue-3'
import { ncIsArray } from 'nocodb-sdk'

// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
export const isDrawerExist = () => document.querySelector('.ant-drawer-open')
export const isLinkDropdownExist = () => document.querySelector('.nc-links-dropdown.active')

/** Portalled overlays belong to the surface that opened them, wherever they render. */
const PORTALLED_OVERLAY_SELECTOR = '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover, .ant-dropdown'

/**
 * Track whether the user's intent sits on an overlay surface (the EE side
 * panel, the interface record sheet). Both are inline siblings of the grid, so
 * both can be active at once and focus alone can't answer it — the canvas grid
 * isn't focusable, so clicking a cell leaves activeElement on BODY rather than
 * inside the grid wrapper. Hence the most recent click is remembered too, in
 * a capture-phase listener.
 *
 * Clicking OUT of the surface while one of its inputs still holds focus blurs
 * that input: without it the next keystroke fires on the stale input — Enter
 * on a focused ant-select opens its dropdown long after the user visually
 * clicked away.
 */
function trackClickIntent(
  surfaceSelector: string,
  {
    ignoreSelector = PORTALLED_OVERLAY_SELECTOR,
    onClick,
  }: { ignoreSelector?: string; onClick?: (target: HTMLElement) => void } = {},
) {
  let lastClickInside = false

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target as HTMLElement | null
        if (!t || t.closest(ignoreSelector)) return

        const inside = !!t.closest(surfaceSelector)
        lastClickInside = inside
        onClick?.(t)

        if (!inside) {
          const surface = document.querySelector(surfaceSelector)
          const active = document.activeElement as HTMLElement | null
          if (surface && active && surface.contains(active) && typeof active.blur === 'function') active.blur()
        }
      },
      true,
    )
  }

  return {
    clickedInside: () => lastClickInside,
    markInside: () => {
      lastClickInside = true
    },
    reset: () => {
      lastClickInside = false
    },
  }
}

// The panel "blocks" grid-level keyboard handling only while the user is
// actually interacting with it. Once they click a grid cell they've explicitly
// switched intent, so grid Tab/Enter/Arrows/Backspace resume working even
// while the panel is still visible.
const expandedFormPanelIntent = trackClickIntent('.nc-expanded-form-panel')

// Reset to "intent on panel" when the panel mounts — so opening EFP via the
// grid expand-row icon (which is technically a grid click) doesn't leave grid
// keyboard active afterwards. Called from ExpandedFormPanel.vue on mount.
export const markExpandedFormPanelFocus = () => expandedFormPanelIntent.markInside()

const isFocusInsideExpandedFormPanel = () => {
  const panel = document.querySelector('.nc-expanded-form-panel')
  if (!panel) return false
  const el = document.activeElement
  return !!el && panel.contains(el)
}

// True when the user is currently interacting with the panel — either focus is
// inside it, or their most recent click landed inside it. Grid keyboard
// handlers check this and bail.
export const isExpandedFormPanelOpen = () =>
  !!document.querySelector('.nc-expanded-form-panel') &&
  (isFocusInsideExpandedFormPanel() || expandedFormPanelIntent.clickedInside())

export const isDrawerOrModalExist = () =>
  !!document.querySelector('.ant-modal.active, .ant-drawer-open') || isExpandedFormPanelOpen()

export const isExpandedFormOpenExist = () =>
  !!document.querySelector('.nc-drawer-expanded-form.active') || isExpandedFormPanelOpen()
export const isNestedExpandedFormOpenExist = () => document.querySelectorAll('.nc-drawer-expanded-form.active')?.length > 1
export const isExpandedCellInputExist = () => document.querySelector('.expanded-cell-input')
export const isNcListSearchInputActive = () => document.activeElement?.closest('.nc-list-search-input')
export const isExtensionPaneActive = () => document.querySelector('.nc-extension-pane')
// `GeneralOverlay` toggles with `v-show`, so its element stays mounted while
// closed — presence alone would report every page carrying one (the chat
// panel's file preview) as permanently overlaid, and the grid's keyboard
// handlers, which bail on this, would never fire again.
export const isGeneralOverlayActive = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.nc-general-overlay')).some((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
export const isSelectActive = () => {
  const els = document.querySelectorAll<HTMLElement>('.ant-select-dropdown')
  return Array.from(els).some((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
  })
}

export const isViewSearchActive = () => document.querySelector('.nc-view-search-data') === document.activeElement
export const isCreateViewActive = () => document.querySelector('.nc-view-create-modal')
export const isActiveElementInsideExtension = () =>
  ['.extension-modal', '.nc-extension-pane', '.nc-modal-extension-market', '.nc-modal-share-collaborate'].some((selector) =>
    document.querySelector(selector)?.contains(document.activeElement),
  )
export const isActiveElementInsideScriptPane = () => document.querySelector('.nc-action-pane')?.contains(document.activeElement)
export const isActiveElementInsideSmartTextPanel = () =>
  document.querySelector('.nc-smart-text-panel')?.contains(document.activeElement)
export const isActiveElementInsideInterfacePanel = () =>
  ['.nc-interface-properties-panel', '.nc-interface-page-description'].some((selector) =>
    document.querySelector(selector)?.contains(document.activeElement),
  )
// The LTAR embed (view mode) the last click landed in — embeds inside the sheet
// take turns owning the keyboard the same way the sheet does against the page.
const INTERFACE_EMBED_HOST_SELECTOR = '.nc-interface-ltar-viz-host'
let _lastClickEmbedHost: Element | null = null

const interfaceRecordSheetIntent = trackClickIntent('.nc-interface-record-form-sheet', {
  // A modal, drawer or expanded cell editor opened FROM a sheet field renders
  // outside the sheet — working inside one is still working in the sheet.
  ignoreSelector: `${PORTALLED_OVERLAY_SELECTOR}, .ant-modal, .ant-drawer, .expanded-cell-input`,
  onClick: (t) => {
    _lastClickEmbedHost = t.closest(INTERFACE_EMBED_HOST_SELECTOR)
  },
})

/** Interface record-detail sheet owns the keyboard: always for the full-screen
 *  page variant (the viz is hidden), otherwise only while the user is working
 *  inside it (focus / last click) — so the grid behind a side sheet keeps its
 *  arrow navigation and the sheet follows the active row. The sheet only
 *  exists inside interface contexts, so classic grids are unaffected.
 *
 *  `hostEl` = the calling grid/list's own element. A viz embedded IN the sheet
 *  is never blocked by the sheet itself — it owns the keyboard while the last
 *  click landed in its embed and focus isn't in a sheet input elsewhere. */
export const isInterfaceRecordSheetOpen = (hostEl?: Element | null) => {
  const sheet = document.querySelector('.nc-interface-record-form-sheet')
  if (!sheet) {
    interfaceRecordSheetIntent.reset()
    _lastClickEmbedHost = null
    return false
  }
  const active = document.activeElement
  if (hostEl && sheet.contains(hostEl)) {
    const embed = hostEl.closest(INTERFACE_EMBED_HOST_SELECTOR)
    if (!embed || embed !== _lastClickEmbedHost) return true
    return !!active && active !== document.body && !embed.contains(active)
  }
  if (sheet.classList.contains('nc-rf-sheet-full')) return true
  return (!!active && sheet.contains(active)) || interfaceRecordSheetIntent.clickedInside()
}
/** Interface builder chrome: the right-side config panel, the topbars, a page
 *  toolbar (the user-filter tab strip lives inside it) and the page sidebar.
 *  Clicking any of it is a context switch, so the mounted grid/list drops its
 *  cell selection — which in turn hands Tab back to native focus traversal.
 *
 *  Deliberately a `closest` test on the CLICK TARGET rather than an outside-click:
 *  cell editors portal their dropdowns and modals to `<body>`, so an outside-click
 *  test counts those as "outside" and would deselect mid-edit. */
export const INTERFACE_CONFIG_CHROME_SELECTOR = [
  '.nc-interface-properties-panel',
  '.nc-interface-editor-topbar',
  '.nc-interface-table-topbar',
  '.nc-interface-table-toolbar',
  '.nc-interface-app-sidebar',
].join(',')
export const isInterfaceConfigChromeTarget = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.(INTERFACE_CONFIG_CHROME_SELECTOR)
export const isTiptapDropdownExistInsideEditor = () => {
  return document.querySelector('.tippy-box')
}

export const ncIsIframe = () => window.self !== window.top

export const isSidebarNodeRenameActive = () => document.querySelector('input.animate-sidebar-node-input-padding')
export function hasAncestorWithClass(element: HTMLElement, className: string | Array<string>): boolean {
  const classNames = ncIsArray(className) ? className : [className]

  return classNames.some((c) => !!element.closest(`.${c}`))
}
export const cmdKActive = () => document.querySelector('.cmdk-modal-active')
export const isCmdJActive = () => document.querySelector('.DocSearch--active')
export const isActiveInputElementExist = (e?: Event) => {
  const activeElement = document.activeElement
  const target = e?.target

  // A rich text editor is a div with the contenteditable attribute set to true.
  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
export const isActiveButtonOrLinkElementExist = (e?: Event) => {
  const activeElement = document.activeElement
  const target = e?.target

  // A rich text editor is a div with the contenteditable attribute set to true.
  return (
    activeElement instanceof HTMLButtonElement ||
    activeElement instanceof HTMLAnchorElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement
  )
}

export const isNcDropdownOpen = () => document.querySelector('.nc-dropdown.active')
export const isDropdownActive = () => document.querySelector('.nc-dropdown')

export const isFieldEditOrAddDropdownOpen = () => document.querySelector('.nc-dropdown-edit-column.active')
export const getScrollbarWidth = () => {
  const outer = document.createElement('div')
  outer.style.visibility = 'hidden'
  outer.style.width = '100px'
  document.body.appendChild(outer)

  const widthNoScroll = outer.offsetWidth
  outer.style.overflow = 'scroll'

  const inner = document.createElement('div')
  inner.style.width = '100%'
  outer.appendChild(inner)

  const widthWithScroll = inner.offsetWidth
  outer?.parentNode?.removeChild(outer)
  return widthNoScroll - widthWithScroll
}

export function getElementAtMouse<T>(cssSelector: string, { clientX, clientY }: { clientX: number; clientY: number }) {
  return document.elementsFromPoint(clientX, clientY).find((el) => el.matches(cssSelector)) as T | undefined
}

export function forcedNextTick(cb: () => void) {
  // See https://github.com/vuejs/vue/issues/9200
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cb()
    })
  })
}

export function isSinglePrintableKey(key: string) {
  // handles other languages as well which key.length === 1 might not
  return [...key].length === 1
}

export const isMousePointerType = (event: Event) => {
  return (
    // PointerEvent style with mouse
    ('pointerType' in event && (event as PointerEvent).pointerType === 'mouse') ||
    // Safari fallback to MouseEvent
    event instanceof MouseEvent
  )
}

export const isTouchEvent = (event: Event | TouchEvent) => !isMousePointerType(event)

export const focusInputEl = (querySelector: string, target?: HTMLElement) => {
  if (typeof window === 'undefined') return

  querySelector = querySelector ? `${querySelector} ` : ''

  const targetEl = target || document
  const inputEl =
    (targetEl.querySelector(`${querySelector}input`) as HTMLInputElement) ||
    (targetEl.querySelector(`${querySelector}textarea`) as HTMLTextAreaElement) ||
    (targetEl.querySelector(`${querySelector}[contenteditable="true"]`) as HTMLElement) ||
    (targetEl.querySelector(`${querySelector}[tabindex="0"]`) as HTMLElement)

  if (inputEl) {
    inputEl?.select?.()
    inputEl?.focus?.()
  }

  return inputEl
}

export const isExpandCellKey = (event: Event) => {
  if (event instanceof KeyboardEvent) {
    return event.key === ' ' && event.shiftKey
  }

  return false
}

/**
 * Check if an element is line-clamped
 *
 * **Note:**
 * The `Range#getBoundingClientRect()` technique works best when text is not deeply nested.
 * This technique has performance overhead — avoid using it on large lists.
 *
 * @param el - The element to check
 * @returns True if the element is line-clamped, false otherwise
 */
export const isLineClamped = (el: HTMLElement): boolean => {
  if (!el) return false

  const range = document.createRange()
  range.selectNodeContents(el)

  const fullHeight = range.getBoundingClientRect().height
  const actualHeight = el.getBoundingClientRect().height

  return fullHeight > actualHeight
}

export const handleOnEscRichTextEditor = (event: KeyboardEvent, editor?: Editor) => {
  if (isTiptapDropdownExistInsideEditor()) {
    event.stopPropagation()

    if (editor && !editor.state.selection.empty) {
      const pos = editor.state.selection.to
      editor.commands.setTextSelection(pos)
      editor.commands.focus()
    }
  }
}

export const estimateTagWidth = ({
  text,
  fontSize = 14,
  fontWeight = 600,
  paddingX = 16, // left + right padding
  iconWidth = 0, // icon width (if you have icon)
  border = 2,
}: {
  text: string
  fontSize?: number
  fontWeight?: number
  paddingX?: number
  iconWidth?: number
  border?: number
}) => {
  // Dummy average char width per font-weight/font-size
  const avgCharWidth = fontWeight >= 600 ? fontSize * 0.6 : fontSize * 0.5

  const textWidth = text.length * avgCharWidth

  const totalWidth = textWidth + paddingX + iconWidth + border

  return totalWidth
}

/**
 * Remove query params from the URL
 * @param keysToRemove - The keys to remove from the URL
 */
export const removeQueryParamsFromURL = (keysToRemove: string[]) => {
  const url = new URL(window.location.href)
  keysToRemove.forEach((key) => url.searchParams.delete(key))
  window.history.replaceState({}, '', url.toString())
}

// Feature detection.
export const supportsKeyboardLock = 'keyboard' in navigator && navigator.keyboard && 'lock' in (navigator.keyboard as any)

export const openContactSalesEmail = (email: string = 'support@nocodb.com') => {
  const a = document.createElement('a')
  a.href = `mailto:${email}`
  a.target = '_blank'
  a.click()
}

export const getValidSlotName = (name: string, prefix?: string, suffix?: string): string => {
  let slotName = name.replace(/\./g, '__')

  if (prefix) {
    slotName = `${prefix}-${slotName}`
  }

  if (suffix) {
    slotName = `${slotName}-${suffix}`
  }

  return slotName
}
