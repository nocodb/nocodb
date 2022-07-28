<script lang="ts" setup>
import { onMounted } from '#imports'
import MdiVisibilityOnIcon from '~icons/mdi/visibility'
import MdiVisibilityOffIcon from '~icons/mdi/visibility-off'

const { view, $api, meta } = useSmartsheetStoreOrThrow()

let isLoading = $ref(false)
// let activeSharedView = $ref(null)
const sharedViewList = ref()

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
const test = (t) => console.log(t)
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
          <!--          <nuxt-link :to="sharedViewUrl(currentView)">
            {{ `${dashboardUrl}#${sharedViewUrl(currentView)}` }}
          </nuxt-link> -->
        </template>
      </a-table-column>
      <!-- Password -->
      <a-table-column key="password" :title="$t('labels.password')" data-index="title">
        <template #default="{ text, record }">
          <div class="flex align-center items-center gap-1">
            <span class="h-min">{{ record.showPassword ? text : '***************************' }}</span>
            <component
              :is="record.showPassword ? MdiVisibilityOffIcon : MdiVisibilityOnIcon"
              @click="record.showPassword = !record.showPassword"
            />
          </div>
        </template>
      </a-table-column>
      <!-- Todo: i18n  -->
      <a-table-column key="meta" title="Download allowed" data-index="title">
        <template #default="{ text }">
          {{ text }}
          <!--          <template v-if="'meta' in currentView"> -->
          <!--            <span>{{ renderAllowCSVDownload(currentView) }}</span> -->
          <!--          </template> -->
        </template>
      </a-table-column>
      <!-- Actions -->
      <a-table-column key="id" :title="$t('labels.actions')" data-index="title">
        <template #default="{ record }">
          <div class="text-xs" :title="text">
            <!--            <v-icon small @click="copyLink(currentView)"> mdi-content-copy </v-icon> -->
            <!--            <v-icon small @click="deleteLink(currentView.id)"> mdi-delete-outline </v-icon> -->
          </div>
        </template>
      </a-table-column>
    </a-table>
  </div>
</template>

<style scoped></style>
