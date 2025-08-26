<script lang="ts" setup>
import dayjs from 'dayjs'
import type Stripe from 'stripe'

const { t } = useI18n()

const { defaultInvoicePaginationData, invoices, invoicePaginationData, loadInvoices } = usePaymentStoreOrThrow()

const paginatedData = computed(() => {
  const { page, pageSize } = invoicePaginationData.value
  const start = (page! - 1) * pageSize!
  const end = start + pageSize!

  return invoices.value.slice(start, end)
})

const getPlanTitle = (record: Stripe.Invoice) => {
  const planTitle = record?.parent?.subscription_details?.metadata?.plan_title || ''
  const planPeriod = record?.parent?.subscription_details?.metadata?.period || ''

  const invoiceLines = record?.lines?.data
  // get last line quantity if it exists
  const seatCount = invoiceLines?.length > 0 ? invoiceLines[invoiceLines.length - 1].quantity : 0

  let returnPlan = ''

  // if seats available
  // Plan (N seats billed annually/monthly)
  if (planTitle && planPeriod) {
    if (seatCount > 0) {
      returnPlan = `${planTitle} (${seatCount === 1 ? '1 seat' : `${seatCount} seats`} billed ${
        planPeriod === 'month' ? 'monthly' : 'annually'
      })`
    } else {
      returnPlan = `${planTitle} (${planPeriod === 'month' ? 'Monthly' : 'Annual'})`
    }
  } else if (planTitle) {
    if (seatCount > 0) {
      returnPlan = `${planTitle} (${seatCount === 1 ? '1 seat' : `${seatCount} seats`})`
    } else {
      returnPlan = planTitle
    }
  }

  return returnPlan
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
  invoicePaginationData.value = { ...defaultInvoicePaginationData, pageSize }
  invoices.value = []

  loadInvoices()
}

onMounted(() => {
  loadInvoices()
})
</script>

<template>
  <section>
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
            <a
              v-e="['c:payment:billing:view-invoice']"
              :href="record.invoice_pdf"
              class="!no-underline !hover:underline font-700 text-small text-nc-content-brand"
            >
              View invoice
            </a>
          </template>
        </template>
        <template v-if="showPagination || paginationCaption" #tableFooter>
          <div class="flex flex-row justify-center items-center bg-gray-50 min-h-10">
            <div class="flex items-center justify-end gap-6 w-full px-6">
              <div v-if="paginationCaption" class="text-nc-content-gray-muted text-bodyDefaultSm">
                Viewing {{ paginationCaption.start }}-{{ paginationCaption.end }} invoices
              </div>

              <NcPaginationStripe
                v-if="showPagination"
                v-model:current="invoicePaginationData.page"
                v-model:page-size="invoicePaginationData.pageSize"
                :has-more="invoicePaginationData.hasMore"
                entity-name="billing-invoices"
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
