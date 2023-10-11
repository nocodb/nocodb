<script setup lang="ts">
/** A dummy page to redirect old shared base url from v1 to latest */
import { useRoute, useRouter } from '#imports'

const route = useRoute()

const router = useRouter()

const { type, name, view } = route.query

if (type && name) {
  router.replace(`/base/${route.params.sourceId}/${type}/${name}${view ? `/${view}` : ''}`)
} else {
  router.replace(`/base/${route.params.sourceId}`)
}
</script>
