<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const router = useRouter()
const route = router.currentRoute

const item = toRef(props, 'item')

const navigateToHome = () => {
  if (route.value.path !== '/') {
    navigateTo(`/`)
  }
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToHome">
    <div class="text-sm">Welcome to <strong>NocoHUB!</strong> We’re excited to have you onboard.</div>
  </NotificationItemWrapper>
</template>
