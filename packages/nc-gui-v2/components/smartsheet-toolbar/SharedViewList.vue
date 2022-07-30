<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { ViewTypes } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import { useRoute } from '#app'
import { onMounted } from '#imports'
import { useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MdiVisibilityOnIcon from '~icons/mdi/visibility'
import MdiVisibilityOffIcon from '~icons/mdi/visibility-off'
import MdiCopyIcon from '~icons/mdi/content-copy'
import MdiDeleteIcon from '~icons/mdi/delete-outline'

interface SharedViewType {
  password: string
  title: string
  uuid: string
  type: ViewTypes
  meta: string | Record<string, any>
  showPassword?: boolean
}

const { view, $api, meta } = useSmartsheetStoreOrThrow()
const { copy } = useClipboard()
const toast = useToast()
const route = useRoute()
const { dashboardUrl } = useDashboard()

let isLoading = $ref(false)
// let activeSharedView = $ref(null)
const sharedViewList = ref<SharedViewType[]>()

const loadSharedViewsList = async () => {
  isLoading = true
  const list = await $api.dbViewShare.list(meta.value?.id as string)

  console.log(unref(sharedViewList))
  console.log(list)

  sharedViewList.value = list

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

  isLoading = false
}

onMounted(loadSharedViewsList)

const sharedViewUrl = (view: SharedViewType) => {
  let viewType
  switch (view.type) {
    case ViewTypes.FORM:
      viewType = 'form'
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
    view.meta = (view.meta && typeof view.meta === 'string' ? JSON.parse(view.meta) : view.meta) as Record<string, any>
    return view.meta.allowCSVDownload ? '✔️' : '❌'
  } else {
    return 'N/A'
  }
}

const copyLink = (view: SharedViewType) => {
  copy(`${dashboardUrl?.value as string}/${sharedViewUrl(view)}`)
  toast.info('Copied to clipboard')
}

const deleteLink = async (id: string) => {
  try {
    await $api.dbViewShare.delete(id)
    toast.success('Deleted shared view successfully')
    await loadSharedViewsList()
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="w-full">
    <a-table class="" size="small" :data-source="sharedViewList" :pagination="{ position: ['bottomCenter'] }">
      <!-- View name -->
      <a-table-column key="title" :title="$t('labels.viewName')" data-index="title">
        <template #default="{ text }">
          <div class="text-xs" :title="text">
            {{ text }}
          </div>
        </template>
      </a-table-column>
      <!-- View Link -->
      <a-table-column key="title" :title="$t('labels.viewLink')" data-index="title">
        <template #default="{ record }">
          <nuxt-link :to="sharedViewUrl(record)" class="text-xs">
            {{ `${dashboardUrl}/${sharedViewUrl(record)}` }}
          </nuxt-link>
        </template>
      </a-table-column>
      <!-- Password -->
      <a-table-column key="password" :title="$t('labels.password')" data-index="title">
        <template #default="{ record }">
          <div class="flex align-center items-center gap-1">
            <template v-if="record.password">
              <span class="h-min">{{ record.showPassword ? record.password : '***************************' }}</span>
              <component
                :is="record.showPassword ? MdiVisibilityOffIcon : MdiVisibilityOnIcon"
                @click="record.showPassword = !record.showPassword"
              />
            </template>
          </div>
        </template>
      </a-table-column>
      <!-- Todo: i18n  -->
      <a-table-column key="meta" title="Download allowed" data-index="title">
        <template #default="{ record }">
          <template v-if="'meta' in record">
            <span>{{ renderAllowCSVDownload(record) }}</span>
          </template>
        </template>
      </a-table-column>
      <!-- Actions -->
      <a-table-column key="id" :title="$t('labels.actions')" data-index="title">
        <template #default="{ record }">
          <div class="text-sm flex gap-2" :title="text">
            <MdiCopyIcon @click="copyLink(record)" />
            <MdiDeleteIcon @click="deleteLink(record.id)" />
          </div>
        </template>
      </a-table-column>
    </a-table>
  </div>
</template>

<style scoped>
:deep(.ant-pagination-item > a){
@apply leading-normal
}
</style>
