<script lang="ts" setup>
import { Modal, message } from 'ant-design-vue'
import { ColumnInj, IsLockedInj, MetaInj, extractSdkResponseErrorMsg, inject, useI18n, useMetas, useNuxtApp } from '#imports'

const { virtual = false } = defineProps<{ virtual?: boolean }>()

const emit = defineEmits(['edit'])

const column = inject(ColumnInj)

const meta = inject(MetaInj)

const isLocked = inject(IsLockedInj)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const deleteColumn = () =>
  Modal.confirm({
    title: h('div', ['Do you want to delete ', h('span', { class: 'font-weight-bold' }, [column?.value?.title]), ' column ?']),
    okText: t('general.delete'),
    okType: 'danger',
    cancelText: t('general.cancel'),
    async onOk() {
      try {
        await $api.dbTableColumn.delete(column?.value?.id as string)

        await getMeta(meta?.value?.id as string, true)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })

const setAsPrimaryValue = async () => {
  try {
    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    // Successfully updated as primary column
    message.success(t('msg.success.primaryColumnUpdated'))

    $e('a:column:set-primary')
  } catch (e) {
    message.error(t('msg.error.primaryColumnUpdateFailed'))
  }
}
</script>

<template>
  <a-dropdown v-if="!isLocked" placement="bottomRight" :trigger="['click']">
    <MdiMenuDown class="h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0" />

    <template #overlay>
      <a-menu class="shadow bg-white">
        <a-menu-item @click="emit('edit')">
          <div class="nc-column-edit nc-header-menu-item">
            <MdiPencil class="text-primary" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </a-menu-item>

        <a-menu-item v-if="!virtual" @click="setAsPrimaryValue">
          <div class="nc-column-set-primary nc-header-menu-item">
            <MdiStar class="text-primary" />

            <!--       todo : tooltip -->
            <!-- Set as Primary value -->
            {{ $t('activity.setPrimary') }}
          </div>
        </a-menu-item>

        <a-menu-item @click="deleteColumn">
          <div class="nc-column-delete nc-header-menu-item">
            <MdiDeleteOutline class="text-error" />
            <!-- Delete -->
            {{ $t('general.delete') }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-header-menu-item {
  @apply text-xs flex items-center px-1 py-2 gap-1;
}
</style>
