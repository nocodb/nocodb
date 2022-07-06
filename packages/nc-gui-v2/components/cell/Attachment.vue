<script>
import { isImage } from '@/components/project/spreadsheet/helpers/imageExt'

export default {
  name: 'AttachmentCell',
  props: ['value', 'column'],
  data: () => ({
    dragOver: false,
  }),
  computed: {
    localState() {
      try {
        return JSON.parse(this.value) || []
      } catch (e) {
        return []
      }
    },
  },
  methods: {
    isImage,
  },
}
</script>

<template>
  <div
    class="d-flex align-center img-container d-100 h-100"
    v-on="$listeners"
    @dragover.prevent="dragOver = true"
    @dragenter.prevent="dragOver = true"
    @dragexit="dragOver = false"
    @dragleave="dragOver = false"
    @dragend="dragOver = false"
    @drop.prevent
  >
    <div v-if="dragOver" class="drop-overlay">
      <div>
        <v-icon small> mdi-cloud-upload-outline </v-icon>
        <span class="caption font-weight-bold">Drop here</span>
      </div>
    </div>
    <template v-if="localState">
      <div v-for="item in localState" :key="item.title" class="thumbnail d-flex align-center justify-center">
        <v-lazy class="d-flex align-center justify-center">
          <v-tooltip bottom>
            <template #activator="{ on }">
              <img v-if="isImage(item.title)" alt="#" :src="item.url" v-on="on" />
              <v-icon v-else-if="item.icon" size="33" v-on="on">
                {{ item.icon }}
              </v-icon>
              <v-icon v-else size="33" v-on="on"> mdi-file </v-icon>
            </template>
            <span>{{ item.title }}</span>
          </v-tooltip>
        </v-lazy>
      </div>
    </template>
  </div>
</template>

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
