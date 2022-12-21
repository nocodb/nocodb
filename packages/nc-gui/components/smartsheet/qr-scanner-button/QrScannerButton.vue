<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
// import type { TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { ref } from 'vue'
import { NOCO } from '#imports'

// interface Props {
//   //   modelValue: boolean
//   //   type: ViewTypes
//   //   title?: string
//   //   selectedViewId?: string
//   //   groupingFieldColumnId?: string
//   //   views: ViewType[]
//   meta: TableType
// }

// const { views = [], meta, selectedViewId, groupingFieldColumnId, ...props } = defineProps<Props>()

// const { meta } = defineProps<Props>()
const meta = inject(MetaInj, ref())
// const view = $(inject(ActiveViewInj, ref()))
// const tableId = meta.value?.id
// const tableName = meta.value?.table_name!
// const tableName = view.

const route = useRoute()
const router = useRouter()

const { $api } = useNuxtApp()
const { project } = useProject()
// const projectName = project.value.title!
// const projectId = project.value.id

const view = inject(ActiveViewInj, ref())

const qrCodeFieldOptions = ref<SelectProps['options']>([])

interface Entry {
  name: string
}

onBeforeMount(init)

async function init() {
  // export const isPrimary = (column: ColumnType) => !!column.pv
  console.log('meta.value?.id', meta.value?.id)

  //   meta.value?.columns[0].pv

  //   const FOO = await $api.dbViewColumn.list(view.value?.id as string, {
  //     // query: {
  //     // },
  //   })
  //   console.log('FOO', FOO)
  //   const foundRowForQrCode = await $api.

  //   const foundRowForQrCode = await $api.dbTableRow.findOne(NOCO, projectName, tableName, {
  // fields: ['']
  // where: 'title5 == "Row 1"',
  //   })

  //   console.log('foundRowForQrCode', foundRowForQrCode)

  // debugger
  qrCodeFieldOptions.value = meta?.value
    ?.columns!.filter((el) => el.uidt === UITypes.QrCode)
    .map((field) => {
      return {
        value: field.id,
        label: field.title,
      }
    })
}

const showQrCodeScanner = ref(false)
const entry = ref<Entry | null>(null)

const selectedCodeColumnIdToScanFor = ref('')

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
  },
})


const onDecode = async (qrCodeValue: string) => {
  try {
    alert(qrCodeValue)

    showQrCodeScanner.value = false

    const whereClause = `(${selectedCodeColumnIdToScanFor.value},eq,${qrCodeValue})`
    const foundRowForQrCode = await $api.dbViewRow.findOne(NOCO, project.value!.id!, meta.value!.id!, view.value!.title!, {
      where: whereClause,
    })

    const rowIdOfFoundRow = meta.value?.id && foundRowForQrCode[meta.value.id]

    const primaryKeyValueForFoundRow = extractPkFromRow(foundRowForQrCode, meta!.value!.columns!)

    console.log('foundRowForQrCode', foundRowForQrCode)

    console.log('rowIdOfFoundRow', rowIdOfFoundRow)

    console.log('primaryKeyValueForFoundRow', primaryKeyValueForFoundRow)

    // const foundRowForQrCode = await $api.dbTableRow.findOne(NOCO, projectName, tableName, {
    //   // fields: ['']
    //   where: 'title5 == "Row 1"',
    // })

    // console.log('foundRowForQrCode', foundRowForQrCode)

    // childrenExcludedList.value = await $api.dbTableRow.list(
    //         NOCO,
    //         projectId,
    //         relatedTableMeta?.value?.id as string,
    //         {
    //           limit: childrenExcludedListPagination.size,
    //           offset: childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1),
    //           where:
    //             childrenExcludedListPagination.query &&
    //             `(${relatedTablePrimaryValueProp.value},like,${childrenExcludedListPagination.query})`,
    //           fields: [relatedTablePrimaryValueProp.value, ...relatedTablePrimaryKeyProps.value],
    //         } as any,
    //       )
    // const response = await fetch(`/api/entries/${qrCode}`)
    // const data = await response.json()
    // entry.value = data
  } catch (error) {
    console.error(error)
  }
}
</script>

<template>
  <div>
    <button @click="showQrCodeScanner = true">Scan QR Code</button>
    <a-modal
      v-model:visible="showQrCodeScanner"
      :class="{ active: showQrCodeScanner }"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-generate-token"
    >
      <div class="relative flex flex-col h-full">
        <a-select
          v-model:value="selectedCodeColumnIdToScanFor"
          class="w-full nc-kanban-grouping-field-select"
          :options="qrCodeFieldOptions"
          placeholder="Select a Code Field (QR or Barcode)"
          not-found-content="No Code Field can be found. Please create one first."
        />

        <qrcode-stream v-if="showQrCodeScanner" @decode="onDecode"></qrcode-stream>
      </div>
    </a-modal>

    <p v-if="entry">Entry found: {{ entry.name }}</p>
  </div>
</template>
