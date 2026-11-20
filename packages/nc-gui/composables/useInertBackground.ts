import type { Ref } from 'vue'

/** While `active`, makes every other <body> child inert so find-in-page stays inside `target`; undoes only its own marks. */
export function useInertBackground(active: Ref<boolean>, target: Ref<HTMLElement | null | undefined>) {
  let marked: HTMLElement[] = []

  function release() {
    marked.forEach((el) => el.removeAttribute('inert'))
    marked = []
  }

  function apply() {
    release()

    const targetEl = target.value
    if (!active.value || !targetEl?.isConnected) return

    const holder = Array.from(document.body.children).find((el) => el.contains(targetEl))
    if (!holder) return

    for (const el of Array.from(document.body.children)) {
      if (el === holder || !(el instanceof HTMLElement) || el.hasAttribute('inert')) continue
      if (['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(el.tagName)) continue

      el.setAttribute('inert', '')
      marked.push(el)
    }
  }

  watch(
    [active, target],
    () => {
      if (active.value) nextTick(apply)
      else release()
    },
    { immediate: true },
  )

  onBeforeUnmount(release)

  return { release }
}
