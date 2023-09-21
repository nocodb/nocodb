<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { IsFormInj, isImage, useAttachment } from '#imports'
import MaximizeIcon from '~icons/nc-icons/maximize'
import LinkIcon from '~icons/nc-icons/link'

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

provide(RowHeightInj, ref(1 as const))

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
    class="!border-1 group transition-all !rounded-xl relative !mb-2 !border-gray-200 hover:bg-gray-50"
    :class="{
      '!bg-white': isLoading,
      '!border-1': isLinked && !isLoading,
      '!hover:border-gray-400': !isLinked,
    }"
    :body-style="{ padding: 0 }"
    :hoverable="false"
  >
    <div class="flex flex-row items-center justify-start w-full">
      <a-carousel v-if="attachment && attachments && attachments.length" autoplay class="!w-24 !h-24">
        <template #customPaging> </template>
        <template v-for="(attachmen, index) in attachments">
          <LazyCellAttachmentImage
            v-if="isImage(attachmen.title, attachmen.mimetype ?? attachmen.type)"
            :key="`carousel-${attachmen.title}-${index}`"
            class="!h-24 !w-24 object-cover !rounded-l-xl"
            :srcs="getPossibleAttachmentSrc(attachmen)"
          />
        </template>
      </a-carousel>
      <div v-else-if="attachment" class="h-24 w-24 w-full !flex flex-row items-center !rounded-l-xl justify-center">
        <img class="object-contain h-24 w-24" src="~assets/icons/FileIconImageBox.png" />
      </div>
      <div class="flex flex-col m-[.75rem] gap-1 flex-grow justify-center">
        <div class="flex justify-between">
          <span class="font-semibold text-gray-800 nc-display-value"> {{ row[relatedTableDisplayValueProp] }} </span>
          <div
            v-if="isLinked && !isLoading"
            class="text-brand-500 text-0.875"
            :class="{
              '!group-hover:mr-12': fields.length === 0,
            }"
          >
            <LinkIcon class="w-4 h-4" />
            Linked
          </div>
          <MdiLoading
            v-else-if="isLoading"
            :class="{
              '!group-hover:mr-8': fields.length === 0,
            }"
            class="w-6 h-6 !text-brand-500 animate-spin"
          />
        </div>

        <div v-if="fields.length > 0 && !isPublic && !isForm" class="flex ml-[-0.25rem] flex-row gap-4 w-10/12">
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
      v-if="!isForm && !isPublic"
      type="text"
      size="lg"
      class="!px-2 nc-expand-item !group-hover:block !hidden !border-1 !shadow-sm !border-gray-200 !bg-white !absolute right-3 bottom-3"
      :class="{
        '!group-hover:right-1.8 !group-hover:bottom-1.7': fields.length === 0,
      }"
      @click.stop="$emit('expand', row)"
    >
      <MaximizeIcon class="w-4 h-4" />
    </NcButton>
  </a-card>
</template>
