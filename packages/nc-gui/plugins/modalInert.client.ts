// Page behind an open modal goes inert so find-in-page stays in the modal; popup containers stay live for its dropdowns.
const PAGE_CONTAINER_SELECTOR = '#__nuxt, .ant-drawer, .ant-modal-wrap'

interface OpenModal {
  wrap: HTMLElement
  marked: HTMLElement[]
}

export default defineNuxtPlugin(() => {
  if (typeof MutationObserver === 'undefined') return

  const openModals: OpenModal[] = []

  let syncScheduled = false

  const isOpen = (wrap: HTMLElement) => wrap.isConnected && wrap.style.display !== 'none'

  const bodyChildOf = (el: HTMLElement) =>
    Array.from(document.body.children).find((child) => child.contains(el)) as HTMLElement | undefined

  const isPageContainer = (el: Element) => el.matches(PAGE_CONTAINER_SELECTOR) || !!el.querySelector(PAGE_CONTAINER_SELECTOR)

  function markBackground(wrap: HTMLElement) {
    const holder = bodyChildOf(wrap)
    const marked: HTMLElement[] = []

    // A modal rendered inside the app (custom container) can't make the app inert without disabling itself
    if (holder && !holder.querySelector('#__nuxt') && holder.id !== '__nuxt') {
      for (const el of Array.from(document.body.children)) {
        if (el === holder || !(el instanceof HTMLElement) || el.hasAttribute('inert') || !isPageContainer(el)) continue

        el.setAttribute('inert', '')
        marked.push(el)
      }
    }

    openModals.push({ wrap, marked })
  }

  function unmark(modal: OpenModal) {
    modal.marked.forEach((el) => el.removeAttribute('inert'))
    openModals.splice(openModals.indexOf(modal), 1)
  }

  function sync() {
    syncScheduled = false

    // closed modals first, newest first, so nested modals hand the page back in order
    for (const modal of [...openModals].reverse()) {
      if (!isOpen(modal.wrap)) unmark(modal)
    }

    for (const wrap of Array.from(document.querySelectorAll<HTMLElement>('.ant-modal-wrap'))) {
      if (isOpen(wrap) && !openModals.some((modal) => modal.wrap === wrap)) markBackground(wrap)
    }
  }

  function scheduleSync() {
    if (syncScheduled) return
    syncScheduled = true
    requestAnimationFrame(sync)
  }

  const isModalWrap = (node: Node) => node instanceof HTMLElement && node.classList.contains('ant-modal-wrap')

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (
        (m.type === 'attributes' && isModalWrap(m.target)) ||
        (m.type === 'childList' && (m.target === document.body || [...m.addedNodes, ...m.removedNodes].some(isModalWrap)))
      ) {
        scheduleSync()
        return
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
})
