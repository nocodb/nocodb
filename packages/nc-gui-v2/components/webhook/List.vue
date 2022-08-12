<script setup lang="ts">
import { message } from 'ant-design-vue'
import { MetaInj } from '~/context'
import { inject, onMounted, ref, useNuxtApp } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'

const emit = defineEmits(['edit'])

const { $api, $e } = useNuxtApp()

const hooks = ref<Record<string, any>[]>([])

const meta = inject(MetaInj)

async function loadHooksList() {
  try {
    const hookList = (await $api.dbTableWebhook.list(meta?.value.id as string)).list as Record<string, any>[]
    hooks.value = hookList.map((hook) => {
      hook.notification = hook.notification && JSON.parse(hook.notification)
      return hook
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function deleteHook(item: Record<string, any>, index: number) {
  try {
    if (item.id) {
      await $api.dbTableWebhook.delete(item.id)
      hooks.value.splice(index, 1)
    } else {
      hooks.value.splice(index, 1)
    }
    message.success('Hook deleted successfully')
    if (!hooks.value.length) {
      hooks.value = []
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:webhook:delete')
}

onMounted(() => {
  loadHooksList()
})
</script>

<template>
  <div class="h-5/6">
    <div class="mb-4">
      <div class="float-left font-bold text-xl mt-2 mb-4">{{ meta.title }} : Webhooks</div>
      <a-button class="float-right" type="primary" size="large" @click="emit('add')">
        {{ $t('activity.addWebhook') }}
      </a-button>
    </div>
    <a-divider />
    <div v-if="hooks.length">
      <a-list item-layout="horizontal" :data-source="hooks" class="cursor-pointer pl-5 pr-5 pt-2 pb-2">
        <template #renderItem="{ item, index }">
          <a-list-item class="pa-2" @click="emit('edit', item)">
            <a-list-item-meta>
              <template #description>
                <span class="uppercase"> {{ item.event }} {{ item.operation }}</span>
              </template>
              <template #title>
                <span class="text-xl normal-case">
                  {{ item.title }}
                </span>
              </template>
              <template #avatar>
                <div class="mt-4">
                  <MdiHook class="text-xl" />
                </div>
              </template>
            </a-list-item-meta>
            <template #extra>
              <div>
                <!-- Notify Via -->
                <div class="mr-2">{{ $t('labels.notifyVia') }} : {{ item?.notification?.type }}</div>
                <div class="float-right pt-2 pr-1">
                  <MdiDeleteOutline class="text-xl" @click.stop="deleteHook(item, index)" />
                </div>
              </div>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </div>
    <div v-else class="pa-4 bg-gray-100 text-gray-600">
      Webhooks list is empty, create new webhook by clicking 'Create webhook' button.
    </div>
  </div>
</template>
