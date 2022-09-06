<script setup lang="ts">
const route = useRoute()

const router = useRouter()

const { type, name, view } = route.query

if (type && name) {
  router.replace(`/base/${route.params.baseId}/${type}/${name}${view ? `/${view}` : ''}`)
} else {
  router.replace(`/base/${route.params.baseId}`)
}
</script>
