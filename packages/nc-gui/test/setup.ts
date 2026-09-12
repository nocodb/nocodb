/**
 * happy-dom has no `OffscreenCanvas`, but the canvas grid constructs one at
 * MODULE scope (`canvas.ts` → `defaultOffscreen2DContext`). Anything importing
 * `~/utils/urlUtils` therefore drags it in and dies on load — which reaches a
 * long way, `ee/utils/interfaceUtils` included.
 *
 * `getSafe2DContext` already tolerates a null context (it only throws when
 * asked to), so returning null is enough to get past import. Any test that
 * genuinely needs to measure text should stub the context itself.
 */
if (!(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas) {
  ;(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {
    constructor(public width = 0, public height = 0) {}

    getContext() {
      return null
    }
  }
}

/**
 * Same chain, one link further: `urlUtils` pulls `plugins/a.i18n`, whose module
 * body calls the Nuxt auto-import `defineNuxtPlugin`. Vitest runs outside the
 * Nuxt app, so it resolves to nothing. Registering the plugin has no meaning
 * here — the export is only imported for `getI18n`.
 */
if (!(globalThis as { defineNuxtPlugin?: unknown }).defineNuxtPlugin) {
  ;(globalThis as { defineNuxtPlugin?: unknown }).defineNuxtPlugin = (plugin: unknown) => plugin
}

/**
 * And `~/utils/columnUtils` — imported by `ee/utils/interfaceUtils` for
 * `isFormViewHiddenCol` — reads the auto-imported `iconMap` while building its
 * `uiTypes` list at module scope. Icons never render under vitest, so every
 * entry can be an inert component.
 */
if (!(globalThis as { iconMap?: unknown }).iconMap) {
  ;(globalThis as { iconMap?: unknown }).iconMap = new Proxy({}, { get: () => () => null })
}
