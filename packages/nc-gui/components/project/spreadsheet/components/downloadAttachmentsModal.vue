<template>
  <v-dialog v-model="showModal" max-width="600">
    <v-card max-width="600" class="pa-6">
      <v-card-title>Download Multiple Attachments</v-card-title>
      <v-select
        label="Attachments Field"
        :items="items"
      />
      <v-btn>Download</v-btn>
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
    accept: String,
    text: String
  },
  data() {
    return {
      items: []
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
    }
  },
  methods: {
  }
}
</script>

<style scoped>

/*.nc-droppable {
  width: 100%;
  min-height: 200px;
  border-radius: 4px;
  border: 2px dashed var(--v-textColor-lighten5);
}*/
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