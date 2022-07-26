<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'
import { MetaInj } from '~/context'
import useViews from '~/composables/useViews'
interface Props {
  visible: boolean
}

const { visible } = defineProps<Props>()
const emit = defineEmits(['visible', 'editOrAdd'])
const hooks = ref([])
const meta = inject(MetaInj)
const { views, loadViews } = useViews(meta as Ref<TableType>)

const afterVisibleChange = (bool: boolean) => {
  console.log('visible', bool)
  emit('visible')
}

onMounted(() => {
  loadViews()
})
</script>

<template>
  <div class="h-5/6">
    <a-typography-title class="inline" :level="4">{{ views?.[0].title }} : Webhooks </a-typography-title>
    <a-button class="float-right" type="primary" size="large" @click="emit('editOrAdd')">
      <!-- TODO: i18n -->
      Create Webhook
    </a-button>
    <a-divider />
    <div v-if="hooks.length > 0">TODO</div>
    <div v-else class="pa-4 bg-gray-100 text-gray-600">
      Webhooks list is empty, create new webhook by clicking 'Create webhook' button.
    </div>
  </div>
</template>
