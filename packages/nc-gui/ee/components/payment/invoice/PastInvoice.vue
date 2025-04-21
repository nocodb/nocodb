<script lang="ts" setup>
import dayjs from 'dayjs'
import type Stripe from 'stripe'

const { t } = useI18n()

const { invoices, invoicePaginationData, plansAvailable } = usePaymentStoreOrThrow()

const paginatedData = computed(() => {
  const { page, pageSize } = invoicePaginationData.value
  const start = (page! - 1) * pageSize!
  const end = start + pageSize!

  return invoices.value.slice(start, end)
})

const getPlanTitle = (record: Stripe.Invoice) => {
  const fk_plan_id = record?.subscription_details?.metadata?.fk_plan_id

  if (!fk_plan_id) return ''

  return plansAvailable.value.find((plan) => plan.id === fk_plan_id)?.title ?? ''
}

const columns: NcTableColumnProps<Stripe.Invoice>[] = [
  {
    key: 'created',
    title: t('datatype.Date'),
    minWidth: 210,
    basis: '25%',
    dataIndex: 'created',
  },
  {
    key: 'plan',
    title: t('general.plan'),
    minWidth: 220,
    basis: '25%',
  },
  {
    key: 'invoiceTotal',
    title: t('labels.invoiceTotal'),
    dataIndex: 'amount_paid',
    basis: '25%',
    minWidth: 150,
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
    basis: '12.5%',
    minWidth: 90,
    dataIndex: 'status',
  },
  {
    key: 'invoice',
    title: t('labels.invoice'),
    dataIndex: 'invoice_pdf',
    basis: '12.5%',
    minWidth: 130,
  },
]
</script>

<template>
  <section>
    <div class="text-base text-nc-content-gray font-700">{{ $t('labels.pastInvoices') }}</div>
    <div class="mt-3 flex-1 flex">
      <NcTable
        class="template-form flex-1 max-h-[540px]"
        body-row-class-name="template-form-row"
        header-row-class-name="relative"
        :bordered="false"
        :data="paginatedData"
        :columns="columns"
        :is-data-loading="invoicePaginationData.isLoading"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created'">
            {{ record.created ? dayjs(record.created * 1000).format('D MMMM YYYY hh:mm A') : '-' }}
          </template>
          <template v-if="column.key === 'plan'"> {{ getPlanTitle(record) }}</template>
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
            <a :href="record.invoice_pdf" class="!no-underline !hover:underline font-700 text-small text-nc-content-brand">
              View invoice
            </a>
          </template>
        </template>
        <template
          v-if="!invoicePaginationData.isLoading && invoicePaginationData.totalRows && invoicePaginationData.totalRows > 10"
          #tableFooter
        >
          <div class="flex flex-row justify-center items-center bg-gray-50 min-h-10">
            <div class="flex justify-between items-center w-full px-6">
              <div>&nbsp;</div>
              <NcPagination
                v-model:current="invoicePaginationData.page"
                v-model:page-size="invoicePaginationData.pageSize"
                :total="+invoicePaginationData.totalRows"
                show-size-changer
                :use-stored-page-size="false"
                :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
                :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
                :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
                :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
              />
              <div class="text-gray-500 text-xs">
                {{ invoicePaginationData.totalRows }} {{ invoicePaginationData.totalRows === 1 ? 'record' : 'records' }}
              </div>
            </div>
          </div>
        </template>
      </NcTable>
    </div>
  </section>
</template>
