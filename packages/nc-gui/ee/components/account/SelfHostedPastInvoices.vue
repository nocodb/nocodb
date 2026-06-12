<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import dayjs from 'dayjs'
import type { OnPremInvoice } from '~/composables/useOnPremLicense'

const { t } = useI18n()

const {
  defaultInvoicePaginationData,
  invoices,
  invoicePaginationData,
  loadInvoices,
  hasAnySubscription,
  addonsCatalog,
  loadAddons,
} = useOnPremLicense()

const paginatedData = computed(() => {
  const { page, pageSize } = invoicePaginationData.value
  const start = (page! - 1) * pageSize!
  const end = start + pageSize!

  return invoices.value.slice(start, end)
})

// Map Stripe product id → add-on key so add-on invoice lines are labeled by their
// catalog name (e.g. "SCIM Provisioning") instead of the base plan — matching the
// cloud billing invoice table.
const productToAddonKey = computed(() => new Map(addonsCatalog.value.map((addon) => [addon.stripe_product_id, addon.addon_key])))

const columns: NcTableColumnProps<OnPremInvoice>[] = [
  {
    key: 'created',
    title: t('datatype.Date'),
    minWidth: 130,
    basis: '16%',
    dataIndex: 'created',
  },
  {
    key: 'plan',
    title: t('general.plan'),
    minWidth: 240,
    basis: '28%',
  },
  {
    key: 'license',
    title: t('title.licenseKey'),
    minWidth: 130,
    basis: '14%',
    dataIndex: 'license_key_masked',
  },
  {
    key: 'invoiceTotal',
    title: t('labels.invoiceTotal'),
    dataIndex: 'amount_paid',
    basis: '14%',
    minWidth: 110,
    format(value, record) {
      if (!ncIsNumber(value)) return ''

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: record.currency || 'USD',
      }).format(value / 100)
    },
  },
  {
    key: 'status',
    title: t('labels.status'),
    basis: '10%',
    minWidth: 80,
    dataIndex: 'status',
  },
  {
    key: 'invoice',
    title: t('labels.invoice'),
    dataIndex: 'invoice_pdf',
    basis: '18%',
    minWidth: 110,
  },
]

const showPagination = computed(() => {
  return invoices.value.length > 10 || invoicePaginationData.value.hasMore
})

const paginationCaption = computed(() => {
  if (!invoices.value.length) return ''

  const page = invoicePaginationData.value.page ?? 1
  const pageSize = invoicePaginationData.value.pageSize ?? 10

  const start = pageSize * (page - 1) + 1
  const end = start + Math.min(paginatedData.value.length - 1, pageSize - 1)

  return {
    start,
    end,
  }
})

const onUpdatePageSize = (pageSize: number) => {
  invoicePaginationData.value = { ...defaultInvoicePaginationData, pageSize, pageCursors: [undefined] }
  invoices.value = []

  loadInvoices()
}

onMounted(() => {
  loadAddons()
  loadInvoices()
})
</script>

<template>
  <section v-if="hasAnySubscription" class="mt-10">
    <div class="text-base text-nc-content-gray font-700">{{ $t('labels.pastInvoices') }}</div>
    <div class="mt-3 flex-1 flex">
      <NcTable
        class="template-form flex-1 max-h-[540px]"
        body-row-class-name="template-form-row !cursor-default"
        header-row-class-name="relative"
        :bordered="true"
        :data="paginatedData"
        :columns="columns"
        :is-data-loading="invoicePaginationData.isLoading"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created'">
            <NcTooltip v-if="record.created" :title="dayjs(record.created * 1000).format('D MMMM YYYY hh:mm A')" placement="top">
              <span>{{ dayjs(record.created * 1000).format('D MMM YYYY') }}</span>
            </NcTooltip>
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'plan'"> {{ buildInvoicePlanLabel(record, productToAddonKey) }}</template>
          <template v-if="column.key === 'license'">
            <code v-if="record.license_key_masked" class="nc-license-key-mono text-xs text-nc-content-gray">
              {{ record.license_key_masked }}
            </code>
            <span v-else class="text-nc-content-gray-muted">—</span>
          </template>
          <template v-if="column.key === 'invoiceTotal'"> {{ column.format?.(record.amount_paid, record) }}</template>
          <template v-if="column.key === 'status'">
            <span
              class="capitalize"
              :class="{
                'text-nc-content-green-dark': record.status === 'paid',
              }"
            >
              {{ record.status }}
            </span>
          </template>
          <template v-if="column.key === 'invoice'">
            <a
              v-e="['c:on-prem:billing:view-invoice']"
              :href="record.invoice_pdf"
              target="_blank"
              rel="noopener noreferrer"
              class="!no-underline !hover:underline font-700 text-small text-nc-content-brand"
            >
              {{ $t('labels.viewInvoice') }}
            </a>
          </template>
        </template>
        <template v-if="showPagination || paginationCaption" #tableFooter>
          <div class="flex flex-row justify-center items-center bg-nc-bg-gray-extralight min-h-10">
            <div class="flex items-center justify-end gap-6 w-full px-6">
              <div v-if="paginationCaption" class="text-nc-content-gray-muted text-bodyDefaultSm">
                {{ $t('labels.viewingInvoicesRange', { start: paginationCaption.start, end: paginationCaption.end }) }}
              </div>

              <NcPaginationStripe
                v-if="showPagination"
                v-model:current="invoicePaginationData.page"
                v-model:page-size="invoicePaginationData.pageSize"
                :has-more="invoicePaginationData.hasMore"
                entity-name="on-prem-billing-invoices"
                @update:current="loadInvoices"
                @update:page-size="onUpdatePageSize"
              />
            </div>
          </div>
        </template>
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('placeholder.noInvoices')" class="!my-0" />
        </template>
      </NcTable>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.nc-license-key-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
