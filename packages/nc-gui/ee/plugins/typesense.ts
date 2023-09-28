import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter'
import InstantSearch from 'vue-instantsearch/vue3/es'

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: 'lNKDTZdJrE76Sg8WEyeN9mXT29l1xq7Q',
    nodes: [
      {
        host: 'rqf5uvajyeczwt3xp-1.a1.typesense.net',
        port: 443,
        protocol: 'https',
      },
    ],
    cacheSearchResultsForSeconds: 2 * 60,
  },
  additionalSearchParameters: {
    query_by: 'anchor,content',
    group_by: 'url',
  },
})

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(InstantSearch)
  nuxtApp.provide('typesenseInstantsearchAdapter', typesenseInstantsearchAdapter)
})
