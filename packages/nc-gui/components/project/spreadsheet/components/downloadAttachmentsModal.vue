<template>
  <v-dialog v-model="showModal" max-width="600">
    <v-card max-width="600" class="pa-6 d-flex flex-column align-center">
      <v-card-title>Download Multiple Attachments</v-card-title>
      <v-select
        label="Attachments Field"
        v-model="selectedAttachmentField"
        :items="availableAttachmentFields"
        item-text="cn"
        class="flex"
      />
      <!--v-select
        label="Filename Field"
        v-model="selectedFilenameField"
        :items="availableColumns"
        item-text="cn"
        class="flex"
      /-->
      <v-btn
        @click="onSubmit"
      >Download</v-btn>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  name: 'DownloadAttachmentsModal',
  components: {},
  props: {
    value: Boolean,
    availableColumns: [Object, Array]
  },
  data() {
    return {
      selectedAttachmentField: '',
      selectedFilenameField: ''
    }
  },
  watch: {
    availableAttachmentFields (newVal) {
      // default to select the first item
      if (newVal && newVal[0]) {
        this.selectedAttachmentField = newVal[0]
      }
    }
  },
  computed: {
    showModal: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      }
    },
    availableAttachmentFields() {
      return this.availableColumns && this.availableColumns.filter(col => col.uidt === 'Attachment')
    }
  },
  methods: {
    onSubmit () {
      if (this.selectedAttachmentField === '') {
        return
      }
      this.$emit('download', {
        selectedAttachmentField: this.selectedAttachmentField
        // selectedFilenameField: this.selectedFilenameField
      })
    }
  }
}
</script>

<style scoped>

</style>

<!--
/**
 * @copyright Copyright (c) 2022, Matthew Lu
 *
 * @author Matthew Lu <seedmachinegun@gmail.com>
 * 
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->