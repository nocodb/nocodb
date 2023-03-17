<script setup lang="ts">
import type { FilterReqType, HookReqType, HookType } from 'nocodb-sdk'
import { MetaInj, extractSdkResponseErrorMsg, inject, message, onMounted, parseProp, ref, useI18n, useNuxtApp } from '#imports'

const emit = defineEmits(['edit', 'add'])

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const hooks = ref<HookType[]>([])

const meta = inject(MetaInj, ref())

async function loadHooksList() {
  try {
    const hookList = (await $api.dbTableWebhook.list(meta.value?.id as string)).list
    hooks.value = hookList.map((hook) => {
      hook.notification = parseProp(hook.notification)
      return hook
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function deleteHook(item: HookType, index: number) {
  try {
    if (item.id) {
      await $api.dbTableWebhook.delete(item.id)
      hooks.value.splice(index, 1)
    } else {
      hooks.value.splice(index, 1)
    }

    // Hook deleted successfully
    message.success(t('msg.success.webhookDeleted'))
    if (!hooks.value.length) {
      hooks.value = []
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:webhook:delete')
}

async function copyHook(hook: HookType) {
  try {
    const newHook = await $api.dbTableWebhook.create(hook.fk_model_id!, {
      ...hook,
      title: `${hook.title} - Copy`,
      active: false,
    } as HookReqType)

    if (newHook) {
      $e('a:webhook:copy')
      // create the corresponding filters
      const hookFilters = (await $api.dbTableWebhookFilter.read(hook.id!, {})).list
      for (const hookFilter of hookFilters) {
        await $api.dbTableWebhookFilter.create(newHook.id!, {
          comparison_op: hookFilter.comparison_op,
          comparison_sub_op: hookFilter.comparison_sub_op,
          fk_column_id: hookFilter.fk_column_id,
          fk_parent_id: hookFilter.fk_parent_id,
          is_group: hookFilter.is_group,
          logical_op: hookFilter.logical_op,
          value: hookFilter.value,
        } as FilterReqType)
      }
      newHook.notification = parseProp(newHook.notification)
      hooks.value.push(newHook)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(() => {
  loadHooksList()
})
</script>

<template>
  <div class="">
    <div class="mb-2">
      <div class="float-left font-bold text-xl mt-2 mb-4">{{ meta?.title }} : Webhooks</div>

      <a-button
        v-e="['c:webhook:add']"
        class="float-right nc-btn-create-webhook"
        type="primary"
        size="large"
        @click="emit('add')"
      >
        {{ $t('activity.addWebhook') }}
      </a-button>
    </div>

    <a-divider />

    <div v-if="hooks.length" class="">
      <a-list item-layout="horizontal" :data-source="hooks" class="cursor-pointer scrollbar-thin-primary">
        <template #renderItem="{ item, index }">
          <a-list-item class="p-2 nc-hook" @click="emit('edit', item)">
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
                <div class="my-1 px-2">
                  <MdiHook class="text-xl" />
                </div>
                <div class="px-2 text-white rounded" :class="{ 'bg-green-500': item.active, 'bg-gray-500': !item.active }">
                  {{ item.active ? 'ON' : 'OFF' }}
                </div>
              </template>
            </a-list-item-meta>

            <template #extra>
              <div>
                <!-- Notify Via -->
                <div class="mr-2">{{ $t('labels.notifyVia') }} : {{ item?.notification?.type }}</div>

                <div class="float-right pt-2 pr-1">
                  <a-tooltip placement="left">
                    <template #title>
                      {{ $t('activity.copyWebhook') }}
                    </template>
                    <MdiContentCopy class="text-xl nc-hook-copy-icon" @click.stop="copyHook(item)" />
                  </a-tooltip>

                  <a-tooltip placement="left">
                    <template #title>
                      {{ $t('activity.deleteWebhook') }}
                    </template>
                    <MdiDeleteOutline class="text-xl nc-hook-delete-icon" @click.stop="deleteHook(item, index)" />
                  </a-tooltip>
                </div>
              </div>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </div>

    <div v-else class="min-h-[75vh]">
      <div class="p-4 bg-gray-100 text-gray-600">
        Webhooks list is empty, create new webhook by clicking 'Create webhook' button.
      </div>
    </div>
  </div>
</template>
