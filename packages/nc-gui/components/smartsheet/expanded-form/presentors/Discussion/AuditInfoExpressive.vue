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

</script>

<template>
  <div v-for="columnKey in columnKeys" class="relative mb-2">
    <GeneralIcon
      icon="ncLink"
      class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
    />
    <div class="mb-1 ml-6.5">
      <template v-if="meta[columnKey]?.field_type === 'SingleLineText'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellText" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="ml-2"> {{ newData[columnKey] }} </span>
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.field_type === 'LongText'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellLongText" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="line-through">{{ oldData[columnKey] ?? '"empty"' }}</span>
          <!-- <span class="text-primary">...more</span> -->
          <span class="mx-2"> to </span>
          <span>{{ newData[columnKey] }}</span>
          <!-- <span class="text-primary">...more</span> -->
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.field_type === 'Email'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellEmail" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="mx-2"> to </span>
          <span> {{ newData[columnKey] }} </span>
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.field_type === 'Currency'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellCurrency" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="line-through"> {{ formatCurrency(oldData[columnKey], meta[columnKey]) }} </span>
          <span class="mx-2"> to </span>
          <span> {{ formatCurrency(newData[columnKey], meta[columnKey]) }} </span>
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.field_type === 'SingleSelect'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellSingleSelect" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
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
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.field_type === 'Attachment'">
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellAttachment" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1 line-through">
            {{ oldData[columnKey]?.length ?? 0 }} files
          </span>
          <span class="ml-2 text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1">
            {{ newData[columnKey]?.length ?? 0 }} files
          </span>
        </div>
      </template>
      <template v-else>
        <div class="text-sm">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellText" class="w-[12px] h-[12px]" />
            {{ columnKey }}
          </span>
          <span class="line-through"> {{ oldData[columnKey] ?? '"empty"' }} </span>
          <span class="mx-2"> to </span>
          <span> {{ newData[columnKey] }} </span>
        </div>
      </template>
    </div>
  </div>
</template>
