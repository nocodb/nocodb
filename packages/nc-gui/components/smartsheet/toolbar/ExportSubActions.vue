<script setup lang="ts">
import type { RequestParams } from 'nocodb-sdk'
import { ExportTypes } from 'nocodb-sdk'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf';
import logo from '@/assets/img/brand/nocodb.png'; // Adjust the path as needed


const isPublicView = inject(IsPublicInj, ref(false))

const fields = inject(FieldsInj, ref([]))

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const selectedView = inject(ActiveViewInj)

const { activeNestedFilters: nestedFilters, activeSorts: sorts } = storeToRefs(useViewsStore())

const isExportingType = ref<ExportTypes | undefined>(undefined)

const pdfModelValue = ref({
  orientation: 'portrait',
  pageSize: 'a4',
});


function checkCellIsAttachment(cell: any): { isAttachment: boolean, link: string[] | null } {
  const attachmentPattern = /([^\s]+\((http[^\)]+)\))/g;


  const matched = cell.match(attachmentPattern);

  if (matched) {

    const links: string[] = [...cell.matchAll(/\((http[^)]+)\)/g)].map(match => match[1]);

    return { isAttachment: true, link: links }; // Extract the URL inside the parentheses
  }
  return { isAttachment: false, link: null };

}

async function makePdf(rowsData: any[]) {
  const doc = new jsPDF({
    orientation: pdfModelValue.value.orientation === "portrait" ? "p" : "l",
    unit: 'mm',
    format: pdfModelValue.value.pageSize,
  });


  //setting logo images
  const logoImg = new Image();
  logoImg.src = logo;
  doc.addImage(logoImg, 'PNG', 15, 15, 50, 10);
  logoImg.onload = () => {
    doc.addImage(logoImg, 'PNG', 10, 10, 50, 25);
    doc.setFontSize(12);
  }

  let currentY = 17;
  let currentX = 70;
  let marginDown = 4;

  doc.setFontSize(10);

  const allRows: { headers: string[]; rows: string[][] }[] = [];

  const headers: string[] = [];

  ///table headers
  headers.push(...Object.keys(rowsData[0]));



  const rows = rowsData.map((row) => headers.map((key) => {

    const value = row[key];

    if (value == null) return null;
    const { isAttachment, link } = checkCellIsAttachment(value)
    if (isAttachment) {
      const attachmentLink = []
      if (link != null) {
        attachmentLink.push(...link)
      }
      return attachmentLink; // Adjust to your needs
    }
    return row[key] !== undefined ? row[key] : "N/A"
  }));



  allRows.push({
    headers: headers,
    rows: rows
  });

  const pageWidth = doc.internal.pageSize.getWidth() - 30;
  const cellWidth = pageWidth / headers.length;
  allRows.forEach((tableData, index) => {
    if (index > 0) {
      doc.addPage();
    }

    (doc as any).autoTable({
      head: [tableData.headers],
      body:

        tableData.rows.map(row => {
          return row.map((cell, index) => {


            return cell;
          })
        })

      ,
      startY: currentY + 15,
      styles: { overflow: 'linebreak' },
      columnStyles: headers.reduce((acc, _, index) => {
        acc[index] = { cellWidth }; // Apply equal width to all columns
        return acc;
      }, {} as { [key: number]: { cellWidth: number } }),
    });
  });



  doc.save('table-data.pdf');
}


const exportFile = async (exportType: ExportTypes) => {
  let offset = 0
  let c = 1
  const responseType = exportType === ExportTypes.EXCEL ? 'base64' : exportType === ExportTypes.CSV ? 'blob' : 'raw'

  isExportingType.value = exportType

  try {
    while (!isNaN(offset) && offset > -1) {
      let res
      if (isPublicView.value) {
        const { exportFile: sharedViewExportFile } = useSharedView()
        res = await sharedViewExportFile(fields.value, offset, exportType, responseType, {
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
        })
      } else {
        console.log(exportType)
        res = await $api.dbViewRow.export(
          'noco',
          base.value?.id as string,
          meta.value?.id as string,
          selectedView?.value.id as string,
          exportType,
          {
            responseType,
            query: {
              fields: fields.value.map((field) => field.title),
              offset,
              sortArrJson: JSON.stringify(sorts.value),
              filterArrJson: JSON.stringify(nestedFilters.value),
            },
          } as RequestParams,
        )
      }

      const { data, headers } = res

      if (exportType === ExportTypes.EXCEL) {
        const workbook = XLSX.read(data, { type: 'base64' })


        XLSX.writeFile(workbook, `${meta.value?.title}_exported_${c++}.xlsx`)
      } else if (exportType === ExportTypes.CSV) {
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })

        saveAs(blob, `${meta.value?.title}_exported_${c++}.csv`)
      } else if (exportType === ExportTypes.PDF) {


        await makePdf(data)
        closePdfExportDialog()
      }

      offset = +headers['nc-export-offset']

      setTimeout(() => {
        isExportingType.value = undefined
      }, 200)
    }
  } catch (e: any) {
    isExportingType.value = undefined
    message.error(await extractSdkResponseErrorMsg(e))

  }
}

const isPdfExportDialogOpen = ref<boolean>(false)

const emits = defineEmits(['closeModal'])

function openPdfExportDialog() {

  emits('closeModal')
  isPdfExportDialogOpen.value = true;
}

function closePdfExportDialog() {

  isPdfExportDialogOpen.value = false;
}

</script>

<template>
  <div class="flex py-3 px-4 font-bold uppercase text-xs text-gray-500">{{ $t('labels.downloadData') }}</div>

  <a-menu-item class="!mx-1 !py-2 !rounded-md">
    <div v-e="['a:download:csv']" class="flex flex-row items-center nc-base-menu-item !py-0"
      @click.stop="exportFile(ExportTypes.CSV)">
      <GeneralLoader v-if="isExportingType === ExportTypes.CSV" class="!max-h-4.5 !-mt-1 !mr-0.7" />
      <component :is="iconMap.csv" v-else />
      <!-- Download as CSV -->
      {{ $t('activity.downloadCSV') }}
    </div>
  </a-menu-item>

  <a-menu-item class="!mx-1 !py-2 !rounded-md">
    <div v-e="['a:download:excel']" class="flex flex-row items-center nc-base-menu-item !py-0"
      @click="exportFile(ExportTypes.EXCEL)">
      <GeneralLoader v-if="isExportingType === ExportTypes.EXCEL" class="!max-h-4.5 !-mt-1 !mr-0.7" />
      <component :is="iconMap.excel" v-else />

      <!-- Download as XLSX -->
      {{ $t('activity.downloadExcel') }}
    </div>
  </a-menu-item>
  <a-menu-item class="!mx-1 !py-2 !rounded-md">
    <div class="flex flex-row items-center nc-base-menu-item !py-0" @click="openPdfExportDialog">
      <component :is="iconMap.pdfFile" />

      <!-- Download as PDF -->
      {{ $t('labels.pdfExport') }}
    </div>
    <LazyDlgPDFExport :isOpen="isPdfExportDialogOpen" @close="closePdfExportDialog" :exportPDF="(orientation, pageSize) => {
      pdfModelValue.orientation = orientation;
      pdfModelValue.pageSize = pageSize;
      exportFile(ExportTypes.PDF)
    }" />
  </a-menu-item>
</template>
