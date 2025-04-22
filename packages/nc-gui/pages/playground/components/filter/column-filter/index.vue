<script lang="ts" setup>
import { SmartsheetToolbarColumnFilter } from '#components'

const options1 = ref({
  index: 0,
  nestedLevel: 0,
  disabled: false,
  isLockedView: false,
  isLogicalOpChangeAllowed: false,
  showNullAndEmptyInFilter: false,
  dbClientType: ClientType.PG,
  actionBtnType: 'text',
  webHook: false,
  link: false,
  isForm: false,
  isPublic: false,
  filterPerViewLimit: 50,
  filtersCount: 0,
  queryFilter: false,
  disableAddNewFilter: false,
})
</script>

<template>
  <MockInjection>
    <div class="bg-gray-100 pb-8 overflow-y-auto">
      <a-card>
        <h4>Simple</h4>
        WIP: cannot mock some API calls
      </a-card>
      <div class="p-4">
        <SmartsheetToolbarColumnFilter
          :nested-level="options1.nestedLevel"
          :disabled="options1.disabled"
          :is-locked-view="options1.isLockedView"
          :is-logical-op-change-allowed="options1.isLogicalOpChangeAllowed"
          :action-btn-type="options1.actionBtnType"
          :web-hook="options1.webHook"
          :link="options1.link"
          :is-form="options1.isForm"
          :is-public="options1.isPublic"
          :filter-per-view-limit="options1.filterPerViewLimit"
          :disable-add-new-filter="options1.disableAddNewFilter"
          :filters-count="options1.filtersCount"
          :query-filter="options1.queryFilter"
        />
      </div>
    </div>
  </MockInjection>
</template>
