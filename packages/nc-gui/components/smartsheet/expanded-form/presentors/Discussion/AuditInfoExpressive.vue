<script setup lang="ts">
/* interface */

const props = defineProps<{
  audit: any
}>()

const details = computed(() => {
  try {
    return JSON.parse(props.audit.details)
  } catch (e) {
    return {}
  }
})

const oldData = computed(() => {
  return details.value.old_data ?? {}
})

const newData = computed(() => {
  return details.value.data ?? {}
})

const meta = computed(() => {
  return details.value.column_meta ?? {}
})

const columnKeys = computed(() => {
  return Object.keys(newData.value)
})

/* formatting */

function formatCurrency(value: string, currencyMeta: any) {
  if (!value) {
    return '"empty"'
  }

  return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
    style: 'currency',
    currency: currencyMeta.currency_code || 'USD',
  }).format(Number(value))
}

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

</script>

<template>
  <div v-for="columnKey in columnKeys" class="relative mb-2">
    <GeneralIcon
      icon="ncLink"
      class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
    />
    <div class="mb-1 ml-6.5">
      <div class="text-sm">
        changed
        <span
          class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
        >
          <SmartsheetHeaderCellIcon :column-meta="{ uidt: meta[columnKey]?.field_type}" class="!w-[12px] !h-[12px] !m-0" />
          {{ columnKey }}
        </span>
        <template v-if="meta[columnKey]?.field_type === 'SingleLineText'">
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="ml-2"> {{ newData[columnKey] }} </span>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'LongText'">
          <span class="line-through">{{ oldData[columnKey] ?? '"empty"' }}</span>
          <!-- <span class="text-primary">...more</span> -->
          <span class="mx-2"> to </span>
          <span>{{ newData[columnKey] }}</span>
          <!-- <span class="text-primary">...more</span> -->
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'Email'">
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="mx-2"> to </span>
          <span> {{ newData[columnKey] }} </span>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'Currency'">
          <span class="line-through"> {{ formatCurrency(oldData[columnKey], meta[columnKey]) }} </span>
          <span class="mx-2"> to </span>
          <span> {{ formatCurrency(newData[columnKey], meta[columnKey]) }} </span>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'SingleSelect'">
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1 line-through"
            :style="{
              backgroundColor: meta[columnKey]?.col_options?.options?.find(
                (option: any) => option.title === oldData[columnKey]
              )?.color ?? '#EAEAEA',
            }"
          >
            {{ oldData[columnKey] ?? '"empty"' }}
          </span>
          <span
            class="ml-2 text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1"
            :style="{
              backgroundColor: meta[columnKey]?.col_options?.options?.find(
                (option: any) => option.title === newData[columnKey]
              )?.color ?? '#EAEAEA',
            }"
          >
            {{ newData[columnKey] }}
          </span>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'Attachment'">
          <span class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1 line-through">
            <template v-if="!oldData[columnKey]?.length">
              0 files
            </template>
            <template v-else>
              <div class="flex items-center gap-1">
                <template v-for="(item, i) of oldData[columnKey]" :key="item.url || item.title">
                  <div class="w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment h-full w-full flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="max-h-full max-w-full" />
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </span>
          <span class="ml-2 text-xs">
            to
          </span>
          <span class="ml-2 text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1">
            <template v-if="!newData[columnKey]?.length">
              0 files
            </template>
            <template v-else>
              <div class="flex items-center gap-1">
                <template v-for="(item, i) of newData[columnKey]" :key="item.url || item.title">
                  <div class="w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment h-full w-full flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="max-h-full max-w-full" />
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </span>
        </template>
        <template v-else>
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="mx-2"> to </span>
          <span> {{ newData[columnKey] }} </span>
        </template>
      </div>
    </div>
  </div>
</template>
