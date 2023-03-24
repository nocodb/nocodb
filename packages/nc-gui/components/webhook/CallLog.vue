<script setup lang="ts">
import type { HookLogType, HookType } from 'nocodb-sdk'
import { onBeforeMount, useApi } from '#imports'

const props = defineProps<Props>()

const { api } = useApi()

const hookLogs = ref<HookLogType[]>([])

interface Props {
  hook: HookType
}

async function loadHookLogList() {
  hookLogs.value = (await api.dbTableWebhookLogs.list(props.hook.id!)).list!
}

onBeforeMount(async () => {
  await loadHookLogList()
})
</script>

<template>
  <div v-for="hookLog of hookLogs">
    {{ hookLog.id }}
  </div>
</template>
