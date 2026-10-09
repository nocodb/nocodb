import VueDOMPurifyHTML from 'vue-dompurify-html'
import { defineNuxtPlugin } from 'nuxt/app'
import { getExternalLinkHref } from '~/utils/urlUtils'

export default defineNuxtPlugin((nuxtApp) => {
  // The directive owns its DOMPurify instance, so this hook never touches other sanitize calls.
  nuxtApp.vueApp.use(VueDOMPurifyHTML, {
    hooks: {
      afterSanitizeAttributes: (node: Element) => {
        if (node.tagName !== 'A') return

        const href = node.getAttribute('href')
        if (!href) return

        const leavingHref = getExternalLinkHref(href)
        if (leavingHref === href) return

        node.setAttribute('href', leavingHref)
        node.setAttribute('data-nc-href', href)
      },
    },
  })
})
