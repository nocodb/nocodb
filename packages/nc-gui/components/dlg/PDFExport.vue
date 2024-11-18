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
    exportPDF: (orientation: string, pageSize: string) => void
}>();


const emit = defineEmits(['close' , 'exportPDF' ]);

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
    
props.exportPDF(  orientation.value ,   pageSize.value);

   
};

const modalWidth = computed(() => {
    return 'max(60vw, 600px)'
})
</script>

<!-- :width="isUIAllowed('commentList') ? 'min(80vw,1280px)' : 'min(70vw,768px)'" -->
<template>
    <a-modal   :footer="null" :closable=true v-model:visible="localIsOpen" :class="{ active: props.isOpen }"
        :width="modalWidth"  @keydown.esc="closeDialog">
        <div data-testid="pdf-export-modal" >
        <a-spin :spinning="false" tip="progressMs" size="large">
            <div class="px-5">
                <div class="prose-xl font-weight-bold my-5">{{ $t('labels.pdfExport') }}</div>

                <div class="mt-5" :class="{
                    'mb-4': true,
                }"> </div>
                <div class="flex flex-row">
                    <div class="orientation-selector">
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
                :disabled="false" @click="generatePDF"  data-testid="pdf-export-button" >
                {{ $t('labels.pdfExport') }}
            </a-button>
        </div>
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
