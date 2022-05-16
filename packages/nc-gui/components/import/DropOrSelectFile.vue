<template>
  <div class="pa-4">
    <div
      class="nc-droppable d-flex align-center justify-center flex-column"
      :style="{
        background : dragOver ? '#7774' : ''
      }"
      @click="$refs.file.click()"
      @drop.prevent="dropHandler"
      @dragover.prevent="dragOver = true"
      @dragenter.prevent="dragOver = true"
      @dragexit="dragOver = false"
      @dragleave="dragOver = false"
      @dragend="dragOver = false"
    >
      <v-icon size="50" color="grey">
        mdi-file-plus-outline
      </v-icon>
      <p class="title grey--text mb-1 mt-2">
        Select {{ text }} file to Upload
      </p>
      <p class="grey--text ">
        or drag and drop {{ text }} file
      </p>
    </div>
    <input
      ref="file"
      class="nc-excel-import-input"
      type="file"
      style="display: none"
      :accept="accept"
      @change="_change($event)"
    >
  </div>
</template>

<script>

export default {
  name: 'DropOrSelectFile',
  props: {
    accept: String,
    text: String
  },
  data() {
    return {
      dragOver: false
    }
  },
  computed: {
    dropOrUpload: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      }
    }
  },
  methods: {
    _change(event) {
      const files = event.target.files
      if (files && files[0]) {
        this.$emit('file', files[0])
        event.target.value = ''
      }
    },
    dropHandler(ev) {
      this.dragOver = false
      let file
      if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items.length && ev.dataTransfer.items[0].kind === 'file') {
          file = ev.dataTransfer.items[0].getAsFile()
        }
      } else if (ev.dataTransfer.files.length) {
        file = ev.dataTransfer.files[0]
      }

      if (this.accept && !this.accept.split(',').some(ext => file.name.endsWith(ext.trim()))) {
        return this.$toast.error(`Dropped file is not an accepted file type. The accepted file types are ${this.accept}!`).goAway(3000)
      }
      if (file) {
        this.$emit('file', file)
      }
    },
    dragOverHandler(ev) {
      // Prevent default behavior (Prevent file from being opened)
      ev.preventDefault()
    }
  }
}
</script>

<style scoped>

.nc-droppable {
  width: 100%;
  min-height: 200px;
  border-radius: 4px;
  border: 2px dashed var(--v-textColor-lighten5);
}
</style>
