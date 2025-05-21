<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

import MdiVisibilityOnIcon from '~icons/mdi/visibility'
import MdiVisibilityOffIcon from '~icons/mdi/visibility-off'

interface SharedViewType {
  password: string
  title: string
  uuid: string
  type: ViewTypes
  meta: string | Record<string, any>
  showPassword?: boolean
}

const { t } = useI18n()

const { $api, meta } = useSmartsheetStoreOrThrow()

const { copy } = useCopy()

const { dashboardUrl } = useDashboard()

const sharedViewList = ref<SharedViewType[]>()

const loadSharedViewsList = async () => {
  sharedViewList.value = (await $api.dbViewShare.list(meta.value?.id as string)).list as SharedViewType[]

  // todo: show active view in list separately
  // const index = sharedViewList.value.findIndex((v) => {
  //   return view?.value?.id === v.id
  // })
  //
  // if (index > -1) {
  //   activeSharedView = sharedViewList.value.splice(index, 1)[0]
  // } else {
  //   activeSharedView = null
  // }
}

onMounted(loadSharedViewsList)

const sharedViewUrl = (view: SharedViewType) => {
  let viewType
  switch (view.type) {
    case ViewTypes.FORM:
      viewType = 'form'
      break
    case ViewTypes.MAP:
      viewType = 'map'
      break
    case ViewTypes.KANBAN:
      viewType = 'kanban'
      break
    default:
      viewType = 'view'
  }
  return `/nc/${viewType}/${view.uuid}`
}

const renderAllowCSVDownload = (view: SharedViewType) => {
  if (view.type === ViewTypes.GRID) {
    view.meta = (view.meta && parseProp(view.meta)) as Record<string, any>
    return view.meta?.allowCSVDownload ? '✔️' : '❌'
  } else {
    return 'N/A'
  }
}

const copyLink = (view: SharedViewType) => {
  try {
    copy(`${dashboardUrl?.value as string}#${sharedViewUrl(view)}`)
    // Copied to clipboard
    message.success(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    message.error(e.message)
  }
}

const deleteLink = async (id: string) => {
  try {
    await $api.dbViewShare.delete(id)
    // Deleted shared view successfully
    message.success(t('msg.success.sharedViewDeleted'))
    await loadSharedViewsList()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="w-full">
    <a-table
      size="small"
      :data-source="sharedViewList"
      :pagination="{ position: ['bottomCenter'] }"
      :locale="{
        emptyText: $t('labels.noData'),
      }"
    >
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
      </template>

      <!-- View name -->
      <a-table-column key="title" :title="$t('labels.viewName')" data-index="title">
        <template #default="{ text, record }">
          <div class="text-xs flex items-center gap-1" :title="text">
            <GeneralViewIcon class="w-5" :meta="record" />
            {{ text }}
          </div>
        </template>
      </a-table-column>

      <!-- View Link -->
      <a-table-column key="title" :title="$t('labels.viewLink')" data-index="title">
        <template #default="{ record }">
          <nuxt-link :to="sharedViewUrl(record)" class="text-xs">
            {{ `${dashboardUrl}#${sharedViewUrl(record)}` }}
          </nuxt-link>
        </template>
      </a-table-column>

      <!-- Password -->
      <a-table-column key="password" :title="$t('labels.password')" data-index="title">
        <template #default="{ record }">
          <div class="flex items-center items-center gap-1">
            <template v-if="record.password">
              <span class="h-min max-w-[250px]">
                {{ record.showPassword ? record.password : Array(record.password.length + 1).join('*') }}
              </span>
              <component
                :is="record.showPassword ? MdiVisibilityOffIcon : MdiVisibilityOnIcon"
                @click="record.showPassword = !record.showPassword"
              />
            </template>
          </div>
        </template>
      </a-table-column>

      <a-table-column key="meta" :title="$t('labels.downloadAllowed')" data-index="title">
        <template #default="{ record }">
          <template v-if="'meta' in record">
            <div class="text-center">{{ renderAllowCSVDownload(record) }}</div>
          </template>
        </template>
      </a-table-column>

      <!-- Actions -->
      <a-table-column key="id" :title="$t('labels.actions')" data-index="title">
        <template #default="{ record }">
          <div class="text-sm flex gap-2" :title="text">
            <component :is="iconMap.copy" class="cursor-pointer" @click="copyLink(record)" />
            <component :is="iconMap.delete" class="cursor-pointer" @click="deleteLink(record.id)" />
          </div>
        </template>
      </a-table-column>
    </a-table>
  </div>
</template>

<style scoped>
:deep(.ant-pagination-item > a) {
  @apply leading-normal;
}
</style>
