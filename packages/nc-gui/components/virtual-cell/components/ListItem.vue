<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { IsFormInj, isImage, useAttachment } from '#imports'
import MaximizeIcon from '~icons/nc-icons/maximize'

const { row, fields, relatedTableDisplayValueProp, isLoading, isLinked, attachment } = defineProps<{
  row: any
  fields: any[]
  attachment: any
  relatedTableDisplayValueProp: string
  isLoading: boolean
  isLinked: boolean
}>()
defineEmits(['expand'])

provide(IsExpandedFormOpenInj, ref(true))

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const { getPossibleAttachmentSrc } = useAttachment()

interface Attachment {
  url: string
  title: string
  type: string
  mimetype: string
}

const attachments: Attachment[] = computed(() => {
  try {
    if (attachment && row[attachment.title]) {
      return typeof row[attachment.title] === 'string' ? JSON.parse(row[attachment.title]) : row[attachment.title]
    }
    return []
  } catch (e) {
    return []
  }
})
</script>

<template>
  <a-card
    class="!border-1 group transition-all !rounded-xl relative !mb-4 !border-gray-200 hover:!bg-gray-50 hover:!border-gray-400"
    :class="{
      '!bg-white !border-blue-500': isLoading,
      '!border-brand-500 !bg-brand-50 !border-2': isLinked,
    }"
    :body-style="{ padding: 0 }"
    :hoverable="false"
  >
    <div class="flex flex-row items-center gap-2 w-full">
      <a-carousel
        v-if="attachment && attachments && attachments.length"
        autoplay
        class="!w-24 border-1 bg-white border-gray-200 !rounded-md !h-24"
      >
        <template #customPaging> </template>
        <template v-for="(attachmen, index) in attachments">
          <LazyCellAttachmentImage
            v-if="isImage(attachmen.title, attachmen.mimetype ?? attachmen.type)"
            :key="`carousel-${attachmen.title}-${index}`"
            class="!h-24 !w-24 object-cover !rounded-md"
            :srcs="getPossibleAttachmentSrc(attachmen)"
          />
        </template>
      </a-carousel>
      <div v-else-if="attachment" class="h-24 w-24 w-full !flex flex-row items-center justify-center">
        <img class="object-contain h-24 w-24" src="~assets/icons/FileIconImageBox.png" />
      </div>
      <div class="flex flex-col gap-1 flex-grow justify-center">
        <div class="flex justify-between">
          <span class="font-bold text-gray-800 ml-1 nc-display-value"> {{ row[relatedTableDisplayValueProp] }} </span>
          <MdiCheck
            v-if="isLinked"
            :class="{
              '!group-hover:mr-8': fields.length === 0,
            }"
            class="w-6 h-6 !text-brand-500"
          />
          <MdiLoading
            v-else-if="isLoading"
            :class="{
              '!group-hover:mr-8': fields.length === 0,
            }"
            class="w-6 h-6 !text-brand-500 animate-spin"
          />
        </div>

        <div v-if="fields.length > 0 && !isForm" class="flex flex-row gap-4 w-10/12">
          <div v-for="field in fields" :key="field.id" :class="attachment ? 'w-1/3' : 'w-1/4'">
            <div class="flex flex-col gap-[-1] max-w-72">
              <LazySmartsheetHeaderVirtualCell
                v-if="isVirtualCol(field)"
                class="!scale-60"
                :column="field"
                :hide-menu="true"
                :hide-icon="true"
              />
              <LazySmartsheetHeaderCell v-else class="!scale-70" :column="field" :hide-menu="true" :hide-icon="true" />

              <LazySmartsheetVirtualCell v-if="isVirtualCol(field)" v-model="row[field.title]" :row="row" :column="field" />
              <LazySmartsheetCell
                v-else
                v-model="row[field.title]"
                class="!text-gray-600 ml-1"
                :column="field"
                :edit-enabled="false"
                :read-only="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <NcButton
      v-if="!isForm"
      type="text"
      size="lg"
      class="!px-2 nc-expand-item !group-hover:block !hidden !absolute right-1 bottom-1"
      @click.stop="$emit('expand', row)"
    >
      <MaximizeIcon class="w-4 h-4" />
    </NcButton>
  </a-card>
</template>
