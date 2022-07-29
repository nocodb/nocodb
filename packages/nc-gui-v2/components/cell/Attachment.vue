<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { inject, ref, useProject, watchEffect } from '#imports'
import { useNuxtApp } from '#app'
import { ColumnInj, MetaInj } from '~/context'
import { NOCO } from '~/lib/constants'
import { isImage } from '~/utils/fileUtils'
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
const editEnabled = inject<boolean>('editEnabled', false)

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

  // this.$emit('input', JSON.stringify(this.localState))
  // this.$emit('update')
}
</script>

<template>
  <div class="main h-100">
    <div class="d-flex align-center img-container">
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

      <v-spacer />

      <MaterialArrowExpandIcon @click.stop="dialog = true" />
      <!--      <v-icon class="expand-icon mr-1" x-small color="primary" @click.stop="dialog = true"> mdi-arrow-expand </v-icon> -->
    </div>

    <input ref="fileInput" type="file" multiple class="d-none" @change="onFileSelection" />
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

/*.img-container {
  margin: 0 -2px;
}

.no-overflow {
  overflow: hidden;
}

.add {
  transition: 0.2s background-color;
  !*background-color: #666666ee;*!
  border-radius: 4px;
  height: 33px;
  margin: 5px 2px;
}

.add:hover {
  !*background-color: #66666699;*!
}

.thumbnail {
  height: 99px;
  width: 99px;
  margin: 2px;
  border-radius: 4px;
}

.thumbnail img {
  !*max-height: 33px;*!
  max-width: 99px;
}

.main {
  min-height: 20px;
  position: relative;
  height: auto;
}

.expand-icon {
  margin-left: 8px;
  border-radius: 2px;
  !*opacity: 0;*!
  transition: 0.3s background-color;
}

.expand-icon:hover {
  !*opacity: 1;*!
  background-color: var(--v-primary-lighten4);
}

.modal-thumbnail img {
  height: 50px;
  max-width: 100%;
  border-radius: 4px;
}

.modal-thumbnail {
  position: relative;
  margin: 10px 10px;
}

.remove-icon {
  position: absolute;
  top: 5px;
  right: 5px;
}

.modal-thumbnail-card {
  .download-icon {
    position: absolute;
    bottom: 5px;
    right: 5px;
    opacity: 0;
    transition: 0.4s opacity;
  }

  &:hover .download-icon {
    opacity: 1;
  }
}

.image-overlay-container {
  max-height: 100vh;
  overflow-y: auto;
  position: relative;
}

.image-overlay-container .close-icon {
  position: fixed;
  top: 15px;
  right: 15px;
}

.overlay-thumbnail {
  transition: 0.4s transform, 0.4s opacity;
  opacity: 0.5;
}

.overlay-thumbnail.active {
  transform: scale(1.4);
  opacity: 1;
}

.overlay-thumbnail:hover {
  opacity: 1;
}

.modal-title {
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  overflow: hidden;
}

.modal-thumbnail-card {
  transition: 0.4s transform;
}

.modal-thumbnail-card:hover {
  transform: scale(1.05);
}

.drop-overlay {
  z-index: 5;
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  right: 0;
  top: 0;
  bottom: 5px;
  background: #aaaaaa44;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.expand-icon {
  opacity: 0;
  transition: 0.4s opacity;
}

.main:hover .expand-icon {
  opacity: 1;
}*/
</style>
