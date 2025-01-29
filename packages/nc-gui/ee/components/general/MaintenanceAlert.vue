<script setup lang="ts">
import dayjs from 'dayjs'
const { checkMaintenance, dismissMaintenance } = useServerConfig()

const maintenance = ref<
  | {
      date: string
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

const timeZoneAbbreviated = () => {
  const { 1: tz } = new Date().toString().match(/\((.+)\)/)

  if (tz.includes(' ')) {
    return tz
      .split(' ')
      .map(([first]) => first)
      .join('')
  } else {
    return tz
  }
}

const compiledMessage = computed(() => {
  if (!maintenance.value) return ''
  const date = maintenance.value.date
  return renderEjsTemplate(maintenance.value.description, {
    date: `${dayjs(date).format('YYYY-MM-DD HH:mm')} ${timeZoneAbbreviated()}`,
    ptTime: dayjs(date).tz('America/Los_Angeles').format('HH:mm z'),
  })
})

const dismiss = async () => {
  dismissMaintenance()
  maintenance.value = undefined
}
</script>

<template>
  <div v-if="maintenance" class="bg-orange-100 flex flex-col gap-2 rounded-xl relative p-3">
    <NcButton size="xsmall" type="text" class="!absolute z-10 !hover:bg-transparent cursor-pointer right-2" @click="dismiss">
      <GeneralIcon icon="close" />
    </NcButton>

    <div class="text-lg flex gap-3 relative items-center font-semibold text-gray-800">
      <img width="24" alt="NocoDB" src="~/assets/img/brand/nocodb-logo.svg" class="flex-none" />
      {{ maintenance.title }}
    </div>

    <div class="text-gray-700 text-md font-medium leading-5" v-html="compiledMessage"></div>

    <NuxtLink v-if="maintenance.url" target="_blank" :href="maintenance.url">
      <NcButton size="small"> Learn More </NcButton>
    </NuxtLink>
  </div>
</template>
