<script lang="ts" setup>
import { ref } from 'vue';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { BaseType } from 'nocodb-sdk';
import Item from '~/components/notification/Item.vue';
import { Drawer } from 'ant-design-vue/es';
import NcModal from '../nc/Modal.vue'

import logo from '@/assets/img/brand/nocodb.png'; // Adjust the path as needed



const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const { xWhere, eventBus } = useSmartsheetStoreOrThrow()

const props = defineProps<{
    isOpen: boolean,
}>();


const emit = defineEmits(['close']);

const localIsOpen = ref(props.isOpen);

watch(
    () => localIsOpen.value,
    (newVal) => {
        if (!newVal) closeDialog();
    }
);

watch(
    () => props.isOpen,
    (newVal) => {
        localIsOpen.value = newVal;
    }
);

function closeDialog() {
    emit('close'); // Notify parent to close the modal
}


const { loadDataForPDFExport } = useViewData(meta, view, xWhere)


const orientation = ref('portrait');

const pageSize = ref('a4');

function setOrientation(text: string) {
    orientation.value = text;
}

const { getPossibleAttachmentSrc } = useAttachment()

function checkCellIsAttachment( cell: any ) : boolean {
  if(Array.isArray(cell)){
    return true
  }else{
return false
  }
}


const generatePDF = async () => {
    
        var res = await loadDataForPDFExport()
        const data: Record<string, any>[] = res.list.map((item: Record<string, any>) => {
            return {
                ...item, 
            };
        });
        const doc = new jsPDF({
            orientation: orientation.value === "portrait" ? "p" : "l",
            unit: 'mm',
            format: pageSize.value,
        });

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


        await headers.push(...Object.keys(data[0]));


        const rows = data.map(item => headers.map(key => {

            const value = item[key];

            if (checkCellIsAttachment(value)) {
                const attachmentLink = [];

                for (let index = 0; index < value.length; index++) {

                    const sources = getPossibleAttachmentSrc(value[index]);

                    if (sources.length > 0) {
                        attachmentLink.push(sources[0]);

                    }

                }


                return attachmentLink; // Adjust to your needs
            }
            return item[key] !== undefined ? item[key] : "N/A"
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

        if (checkCellIsAttachment(cell)) {
        return { content: cell, styles: { textColor: [0, 0, 255] } }; // Style for the link
      }
      return cell; 
    }) })
                
                ,
                startY: currentY + 15,
                styles: { overflow: 'linebreak' },
                columnStyles: headers.reduce((acc, _, index) => {
                    acc[index] = { cellWidth }; // Apply equal width to all columns
                    return acc;
                }, {} as { [key: number]: { cellWidth: number } }),
            });
        });
       


   await doc.save('table-data.pdf');
   emit('close')
    
};

const modalWidth = computed(() => {
    return 'max(60vw, 600px)'
})
</script>

<!-- :width="isUIAllowed('commentList') ? 'min(80vw,1280px)' : 'min(70vw,768px)'" -->
<template>
    <a-modal :footer="null" :closable=true v-model:visible="localIsOpen" :class="{ active: props.isOpen }"
        :width="modalWidth"  @keydown.esc="closeDialog">
        <a-spin :spinning="false" tip="progressMs" size="large">
            <div class="px-5">
                <div class="prose-xl font-weight-bold my-5">{{ $t('labels.pdfExport') }}</div>

                <div class="mt-5" :class="{
                    'mb-4': true,
                }"> </div>
                <div class="flex flex-row">
                    <div class="orientation-selector  ">
                        <span class="font-semibold">{{ $t('labels.orientation') }}</span>

                        <div className="flex flex-row">
                            <label class="font-small">
                                <input type="radio" className="focus:primary" value="portrait" v-model="orientation" />
                                <span class="radio-icon">
                                </span>
                                Portrait
                            </label>
                            <div className="p-2"></div>
                            <label class="font-small">
                                <input type="radio" value="landscape" v-model="orientation" />
                                <span class="radio-icon">
                                </span>
                                Landscape
                            </label>
                        </div>
                    </div>
                    <div className="px-8"></div>
                    <div class="orientation-selector">
                        <span class="font-semibold">{{ $t('labels.pageSize') }}</span>

                        <div className="flex flex-row">
                            <label class="font-small">
                                <input type="radio" value="a4" v-model="pageSize" />
                                <span class="radio-icon">
                                </span>
                                A4
                            </label>
                            <div className="p-2"></div>
                            <label class="font-small">
                                <input type="radio" value="a5" v-model="pageSize" />
                                <span class="radio-icon">
                                </span>
                                A5
                            </label>
                            <!-- <div className="p-2"></div>
                            <label class="font-small">
                                <input type="radio" value="a10" v-model="pageSize" />
                                <span class="radio-icon">
                                </span>
                                A10
                            </label> -->

                        </div>
                    </div>
                </div>
                
            </div>
        </a-spin>

        <div className="px-5 pt-3">
            <a-button key="pre-import" type="primary" class="nc-btn-import !rounded-md" :loading="false"
                :disabled="false" @click="generatePDF">
                {{ $t('labels.pdfExport') }}
            </a-button>
        </div>
       
    </a-modal>

</template>

<style scoped>


.orientation-selector {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
}

.orientation-selector label {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.orientation-selector input[type="radio"] {
    margin-right: 8px;
    
}

.orientation-selector input[type="radio"]:checked {
  background-color: rgba(var(--color-primary), 1); /* Use primary color for checked background */
  border-color: rgba(var(--color-primary), 1); /* Primary color for the border */
}

.orientation-selector input[type="radio"]:focus {
  outline-color: rgba(var(--color-primary), 1); /* Primary color for focus outline */
}


.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.dialog {
    background: white;
    padding: 20px;
    border-radius: 5px;
    width: 300px;
}

.dialog-actions {
    display: flex;
    justify-content: space-between;
}
</style>
