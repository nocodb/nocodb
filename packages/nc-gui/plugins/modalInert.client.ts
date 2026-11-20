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

  // Ant keeps a closed modal's or drawer's container in <body>; only mark what is showing, or it stays dead if reopened
  const isShown = (el: Element) =>
    el.matches('#__nuxt, .ant-drawer-open') || (el instanceof HTMLElement && el.matches('.ant-modal-wrap') && isOpen(el))

  const isPageContainer = (el: Element) => isShown(el) || Array.from(el.querySelectorAll(PAGE_CONTAINER_SELECTOR)).some(isShown)

  // a modal opening inside something an earlier modal marked must be live again
  function releaseFromOthers(el: HTMLElement) {
    for (const modal of openModals) {
      const index = modal.marked.indexOf(el)
      if (index === -1) continue

      modal.marked.splice(index, 1)
      el.removeAttribute('inert')
    }
  }

  function markBackground(wrap: HTMLElement) {
    const holder = bodyChildOf(wrap)
    const marked: HTMLElement[] = []

    if (holder) releaseFromOthers(holder)

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
    const index = openModals.indexOf(modal)
    openModals.splice(index, 1)

    // a modal opened later still covers what this one marked, so it keeps it inert until it closes
    const newest = openModals[openModals.length - 1]
    if (newest && index < openModals.length) newest.marked.push(...modal.marked)
    else modal.marked.forEach((el) => el.removeAttribute('inert'))
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
