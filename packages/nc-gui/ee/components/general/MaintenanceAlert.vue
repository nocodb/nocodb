<script setup lang="ts">
import dayjs from 'dayjs'

const { checkMaintenance, dismissMaintenance } = useServerConfig()

const maintenance = ref<
  | {
      startDate: string
      endDate: string
      description: string
      title: string
      url?: string
    }
  | undefined
>()

onMounted(async () => {
  await checkMaintenance()
    .then((res) => {
      maintenance.value = res
    })
    .catch((_e) => {})
})

function renderEjsTemplate(template: string, data: Record<string, string>) {
  return template.replace(/<%= (\w+) %>/g, (match, key) => data[key] || '')
}

const compiledMessage = computed(() => {
  if (!maintenance.value) return ''
  const startDate = maintenance.value.startDate
  const endDate = maintenance.value.endDate
  return renderEjsTemplate(maintenance.value.description, {
    startDate: dayjs(startDate).format('Do MMMM YYYY'),
    endDate: dayjs(endDate).format('Do MMMM YYYY'),
    startTime: dayjs(startDate).format('hh:mm a'),
    endTime: dayjs(endDate).format('hh:mm a'),
  })
})

const dismiss = async () => {
  dismissMaintenance()
  maintenance.value = undefined
}
</script>

<template>
  <div
    v-if="maintenance"
    class="bg-nc-bg-orange-light border-nc-orange-200 border-1 nc-maintenance-sidebar-banner flex flex-col gap-2 rounded-xl relative p-3"
  >
    <div class="flex gap-3 relative items-center">
      <GeneralIcon icon="alertTriangleSolid" class="w-5 h-5 text-nc-content-orange-medium fill-nc-orange-medium" />
      <div class="text-bodyBold text-nc-content-gray">
        {{ maintenance.title }}
      </div>
    </div>

    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm" v-html="compiledMessage"></div>

    <div class="flex items-center gap-3 justify-between">
      <NuxtLink v-if="maintenance.url" class="!text-nc-content-brand !text-bodyDefaultSm" target="_blank" :href="maintenance.url">
        Learn More
      </NuxtLink>
      <div v-else class="flex-grow"></div>
      <NcButton size="small" class="!text-nc-content-gray-subtle text-bodyDefaultSm" type="link" @click="dismiss">
        Dismiss
      </NcButton>
    </div>
  </div>
</template>
