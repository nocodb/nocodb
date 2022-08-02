<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { inject, reactive, ref, useProject, watchEffect } from '#imports'
import { useNuxtApp } from '#app'
import { ColumnInj, EditModeInj, MetaInj } from '~/context'
import { NOCO } from '~/lib'
import { isImage } from '~/utils'
import MaterialPlusIcon from '~icons/mdi/plus'
import MaterialArrowExpandIcon from '~icons/mdi/arrow-expand'

interface Props {
  modelValue: string | any[] | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const isPublicForm = inject<boolean>('isPublicForm', false)
const isForm = inject<boolean>('isForm', false)
const meta = inject(MetaInj)
const column = inject(ColumnInj)
const editEnabled = inject(EditModeInj, ref(false))

const localFilesState = reactive([])
const attachments = ref([])
const uploading = ref(false)
const fileInput = ref<HTMLInputElement>()

const { $api } = useNuxtApp()

const { project } = useProject()

const toast = useToast()

watchEffect(() => {
  if (modelValue) {
    attachments.value = ((typeof modelValue === 'string' ? JSON.parse(modelValue) : modelValue) || []).filter(Boolean)
  }
})

const selectImage = (file: any, i: unknown) => {
  // todo: implement
}

const openUrl = (url: string, target = '_blank') => {
  window.open(url, target)
}

const addFile = () => {
  fileInput.value?.click()
}

const onFileSelection = async (e: unknown) => {
  // if (this.isPublicGrid) {
  //   return
  // }
  // if (!this.$refs.file.files || !this.$refs.file.files.length) {
  //   return
  // }

  // if (this.isPublicForm) {
  //   this.localFilesState.push(...Array.from(this.$refs.file.files).map((file) => {
  //     const res = { file, title: file.name }
  //     if (isImage(file.name, file.mimetype)) {
  //       const reader = new FileReader()
  //       reader.onload = (e) => {
  //         this.$set(res, 'data', e.target.result)
  //       }
  //       reader.readAsDataURL(file)
  //     }
  //     return res
  //   }))
  //
  //   this.$emit('input', this.localFilesState.map(f => f.file))
  //   return
  // }

  // todo : move to com
  uploading.value = true
  const newAttachments = []
  for (const file of fileInput.value?.files ?? []) {
    try {
      const data = await $api.storage.upload(
        {
          path: [NOCO, project.value.title, meta?.value?.title, column?.title].join('/'),
        },
        {
          files: file,
          json: '{}',
        },
      )
      newAttachments.push(...data)
    } catch (e: any) {
      toast.error(e.message || 'Some internal error occurred')
      uploading.value = false
      return
    }
  }
  uploading.value = false
  emit('update:modelValue', JSON.stringify([...attachments.value, ...newAttachments]))
}
</script>

<template>
  <div class="h-full w-full">
    <div class="flex items-center img-container">
      <div class="d-flex no-overflow">
        <div
          v-for="(item, i) in isPublicForm ? localFilesState : attachments"
          :key="item.url || item.title"
          class="thumbnail align-center justify-center d-flex"
        >
          <!--          <v-tooltip bottom> -->
          <!--            <template #activator="{ on }"> -->
          <!--              <v-img
                          v-if="isImage(item.title, item.mimetype)"
                          lazy-src="https://via.placeholder.com/60.png?text=Loading..."
                          alt="#"
                          max-height="99px"
                          contain
                          :src="item.url || item.data"
                          v-on="on"
                          @click="selectImage(item.url || item.data, i)"
                        >             -->
          <img
            v-if="isImage(item.title, item.mimetype)"
            alt="#"
            style="max-height: 30px; max-width: 30px"
            :src="item.url || item.data"
            @click="selectImage(item.url || item.data, i)"
          />
          <!--                <template #placeholder> -->
          <!--                  <v-skeleton-loader type="image" :height="active ? 33 : 22" :width="active ? 33 : 22" /> -->
          <!--                </template> -->
          <v-icon v-else-if="item.icon" :size="active ? 33 : 22" v-on="on" @click="openUrl(item.url || item.data, '_blank')">
            {{ item.icon }}
          </v-icon>
          <v-icon v-else :size="active ? 33 : 22" v-on="on" @click="openUrl(item.url || item.data, '_blank')"> mdi-file </v-icon>
          <!--            </template> -->
          <!--            <span>{{ item.title }}</span> -->
          <!--          </v-tooltip> -->
        </div>
      </div>
      <!--      todo: hide or toggle based on ancestor -->
      <div class="add d-flex align-center justify-center px-1 nc-attachment-add" @click="addFile">
        <v-icon v-if="uploading" small color="primary" class="nc-attachment-add-spinner"> mdi-loading mdi-spin</v-icon>
        <!--        <v-btn v-else-if="isForm" outlined x-small color="" text class="nc-attachment-add-btn">
          <v-icon x-small color="" icon="MaterialPlusIcon"> mdi-plus </v-icon>
          Attachment
        </v-btn>
        <v-icon  small color="primary nc-attachment-add-icon">
          mdi-plus
        </v-icon> -->
        <MaterialPlusIcon />
      </div>

      <MaterialArrowExpandIcon @click.stop="dialog = true" />
      <!--      <v-icon class="expand-icon mr-1" x-small color="primary" @click.stop="dialog = true"> mdi-arrow-expand </v-icon> -->
    </div>

    <input ref="fileInput" type="file" multiple class="hidden" @change="onFileSelection" />
  </div>
</template>

<style scoped lang="scss">
.thumbnail {
  height: 30px;
  width: 30px;
  margin: 2px;
  border-radius: 4px;

  img {
    max-height: 33px;
    max-width: 33px;
  }
}

.expand-icon {
  margin-left: 8px;
  border-radius: 2px;
  transition: 0.3s background-color;
}

.expand-icon:hover {
  background-color: var(--v-primary-lighten4);
}
</style>
