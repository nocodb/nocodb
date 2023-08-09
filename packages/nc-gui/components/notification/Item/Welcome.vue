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
    <template #avatar>
      <img src="~/assets/img/icons/64x64.png" class="w-6" />
    </template>

    <div class="text-xs">Welcome to <strong>NocoHUB!</strong> We’re excited to have you onboard.</div>
  </NotificationItemWrapper>
</template>
