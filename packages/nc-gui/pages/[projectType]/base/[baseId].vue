<script setup lang="ts">
const route = useRoute()

const router = useRouter()

router.replace(`/base/${route.params.baseId}`)
</script>
