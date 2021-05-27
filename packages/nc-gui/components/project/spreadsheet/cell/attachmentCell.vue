<template>
  <div class="d-flex align-center img-container d-100 h-100" v-on="$listeners"
       @dragover.prevent="dragOver = true"
       @dragenter.prevent="dragOver = true"
       @dragexit="dragOver = false"
       @dragleave="dragOver = false"
       @dragend="dragOver = false"
       @drop.prevent
  >


    <div v-if="dragOver" class="drop-overlay">
      <div>
        <v-icon small>mdi-cloud-upload-outline</v-icon>
        <span class="caption font-weight-bold">Drop here</span>
      </div>
    </div>


    <div v-if="localState" v-for="item in localState" class="thumbnail d-flex align-center justify-center">
      <v-lazy class="d-flex align-center justify-center">
        <v-tooltip bottom>
          <template v-slot:activator="{on}">
            <img alt="#" v-if="isImage(item.title)" :src="item.url" v-on="on">
            <v-icon v-else-if="item.icon" v-on="on" size="33">{{ item.icon }}</v-icon>
            <v-icon v-else v-on="on" size="33">mdi-file</v-icon>
          </template>
          <span>{{ item.title }}</span>
        </v-tooltip>
      </v-lazy>
    </div>
  </div>
</template>

<script>
import {isImage} from "@/components/project/spreadsheet/helpers/imageExt";

export default {
  name: "attachmentCell",
  props: ['value', 'column'],
  computed: {
    localState() {
      try {
        return JSON.parse(this.value) || []
      } catch (e) {
        return []
      }
    }
  },
  data: () => ({
    dragOver: false
  }),
  methods: {
    isImage,
  }
}
</script>

<style scoped>
.img-container {
  margin: 0 -2px;
  position: relative;
}

.thumbnail {
  height: 29px;
  width: 29px;
  margin: 2px;
  border-radius: 4px;
}

.thumbnail img {
  max-height: 29px;
  max-width: 29px;
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

</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
