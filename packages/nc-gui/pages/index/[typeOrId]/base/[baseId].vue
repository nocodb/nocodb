<script setup lang="ts">
/** A dummy page to redirect old shared base url from v1 to latest */

definePageMeta({
  // This hop is anonymous and embeddable — it only ever forwards to /base/<uuid>.
  // Without this, middleware/02.security.global.ts 403s the legacy
  // `/nc/base/<uuid>` embed before the redirect below can run.
  pageType: 'shared-view',
})

const route = useRoute()

const router = useRouter()

const { type, name, view } = route.query

if (type && name) {
  router.replace(`/base/${route.params.sourceId}/${type}/${name}${view ? `/${view}` : ''}`)
} else {
  router.replace(`/base/${route.params.sourceId}`)
}
</script>
