<template>
  <div class="main">
    <div class="d-flex align-center img-container">

      <div v-for="(item,i) in localState" :key="i" class="thumbnail align-center justify-center d-flex">
        <v-tooltip bottom>
          <template v-slot:activator="{on}">
            <v-img
              lazy-src="https://via.placeholder.com/60.png?text=Loading..."
              :key="item.url"
              alt="#" max-height="33px" contain v-if="isImage(item.title)" :src="item.url" v-on="on"
              @click="selectImage(item.url,i)">
              <template v-slot:placeholder>
                <v-skeleton-loader type="image" height="33" width="33"></v-skeleton-loader>
              </template>
            </v-img>
            <v-icon v-else-if="item.icon" v-on="on" size="33" @click="openUrl(item.url,'_blank')">{{
                item.icon
              }}
            </v-icon>
            <v-icon v-else v-on="on" size="33" @click="openUrl(item.url,'_blank')">mdi-file</v-icon>
          </template>
          <span>{{ item.title }}</span>
        </v-tooltip>
      </div>

      <div class="add d-flex align-center justify-center px-1" @click="addFile">
        <v-icon v-if="uploading" small color="primary">mdi-loading mdi-spin</v-icon>
        <v-icon v-else small color="primary">mdi-plus</v-icon>
      </div>


      <v-spacer>
      </v-spacer>

      <v-icon class="expand-icon mr-1" x-small color="primary" @click.stop="dialog = true">mdi-arrow-expand</v-icon>
      <input type="file" multiple @change="onFileSelection" class="d-none" ref="file"/>
    </div>


    <v-dialog
      v-model="dialog"
      width="800"
    >

      <v-card class="h-100 images-modal">

        <v-card-text class="h-100 backgroundColor">

          <v-btn small class="my-4" @click="addFile" :loading="uploading">
            <v-icon small class="mr-2">mdi-link-variant</v-icon>
            Attach File
          </v-btn>


          <div class="d-flex flex-wrap h-100">

            <v-container fluid style="max-height:calc(90vh - 80px);overflow-y: auto">

              <v-row>
                <v-col v-for="(item,i) in localState" :key="i" cols="4">

                  <v-card class="modal-thumbnail-card align-center justify-center d-flex" height="200px"
                          style="position: relative">
                    <v-icon small class="remove-icon" @click="removeItem(i)">
                      mdi-close-circle
                    </v-icon>
                    <div class="pa-2 d-flex align-center" style="height:200px">
                      <img v-if="isImage(item.title)" style="max-height: 100%;max-width: 100%" alt="#" :src="item.url"
                           @click="selectImage(item.url,i)">

                      <v-icon v-else-if="item.icon" size="33" @click="openUrl(item.url,'_blank')">{{
                          item.icon
                        }}
                      </v-icon>
                      <v-icon v-else size="33" @click="openUrl(item.url,'_blank')">mdi-file</v-icon>
                    </div>
                  </v-card>
                  <p class="caption mt-2 modal-title" :title="item.title">{{ item.title }}</p>
                </v-col>
              </v-row>

            </v-container>
          </div>
        </v-card-text>


      </v-card>
    </v-dialog>


    <v-overlay v-model="showImage" z-index="99999" opacity=".93">
      <div class="image-overlay-container" v-click-outside="hideIfVisible">

        <v-carousel v-model="carousel" height="calc(100vh - 100px)" hide-delimiters v-if="showImage && selectedImage">
          <v-carousel-item

            v-for="(item,i) in localState"
            :key="i"
          >
            <div class="mx-auto d-flex flex-column justify-center align-center">
              <p class="title text-center">{{ item.title }}</p>

              <div style="width:90vh;height:calc(100vh - 150px)" class="d-flex align-center justify-center">
                <img v-if="isImage(item.title)" style="max-width:90vh;max-height:calc(100vh - 100px)"
                     :src="item.url">
                <v-icon v-else-if="item.icon" size="55">{{ item.icon }}</v-icon>
                <v-icon v-else size="55">mdi-file</v-icon>

              </div>
            </div>
          </v-carousel-item>
        </v-carousel>
        <v-sheet
          class="mx-auto align-center justify-center"
          max-width="90vw"
          height="80px"
          style="background: transparent"
        >
          <v-slide-group
            multiple
            show-arrows
          >
            <v-slide-item
              v-for="(item,i) in localState"
              :key="i"
              v-slot="{ active, toggle }"
            >
              <!--            <div class="d-flex justify-center" style="height:80px">-->
              <v-card
                class="ma-2 pa-2 d-flex align-center justify-center overlay-thumbnail"
                :class="{active: carousel === i}"
                width="48" height="48"
                @click="carousel = i"
                :key="i">
                <img v-if="isImage(item.title)" style="max-width:100%;max-height:100%"
                     :src="item.url">
                <v-icon v-else-if="item.icon" size="48">{{ item.icon }}</v-icon>
                <v-icon v-else size="48">mdi-file</v-icon>
              </v-card>
              <!--            </div>-->
            </v-slide-item>
          </v-slide-group>
        </v-sheet>

        <v-icon x-large class="close-icon" @click="showImage=false">
          mdi-close-circle
        </v-icon>
      </div>

    </v-overlay>

  </div>
</template>

<script>
import {isImage} from "@/components/project/spreadsheet/helpers/imageExt";

export default {
  name: "attachment",
  props: ['dbAlias', 'value'],
  methods: {
    openUrl(url, target) {
      window.open(url, target)
    },
    isImage,
    hideIfVisible() {
      if (this.showImage) {
        this.showImage = false;
      }
    },
    selectImage(selectedImage, i) {
      this.showImage = true;
      this.carousel = i;
      this.selectedImage = selectedImage;
    },
    addFile() {
      this.$refs.file.click();
    },
    async onFileSelection() {
      if (!this.$refs.file.files || !this.$refs.file.files.length) {
        return;
      }
      this.uploading = true;
      for (const file of this.$refs.file.files) {
        const item = await this.$store.dispatch('sqlMgr/ActUpload', [{
          dbAlias: this.dbAlias
        }, 'xcAttachmentUpload', {public: true}, file,])
        this.localState.push(item);
      }

      this.uploading = false;
      this.$emit('input', JSON.stringify(this.localState))
      this.$emit('update')
    },
    removeItem(i) {
      this.localState.splice(i, 1)
      this.$emit('input', JSON.stringify(this.localState))
      this.$emit('update')
    },
    onArrowDown(e) {
      if (!this.showImage) return;
      e = e || window.event;
      if (e.keyCode == '37') {
        this.carousel = (this.carousel || this.localState.length) - 1;
      } else if (e.keyCode == '39') {
        this.carousel = ++this.carousel % this.localState.length;
      }

    }
  }, data: () => ({
    carousel: null,
    uploading: false,
    localState: '',
    dialog: false,
    showImage: false,
    selectedImage: null,
  }),
  created() {
    try {
      this.localState = (typeof this.value === 'string' ? JSON.parse(this.value) : this.value) || [];
    } catch (e) {
      this.localState = [];
    }
    document.addEventListener('keydown', this.onArrowDown)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onArrowDown)
  },
  mounted() {
  }, watch: {
    value(val) {
      try {
        this.localState = (typeof val === 'string' ? JSON.parse(val) : val) || [];
      } catch (e) {
        this.localState = [];
      }
    },
    // localState(val) {
    //   if (this.isForm) {
    //     this.$emit('input', JSON.stringify(val))
    //   }
    // }
  },
}
</script>

<style scoped>
.img-container {
  margin: 0 -2px;
}

.add {
  transition: .2s background-color;
  /*background-color: #666666ee;*/
  border-radius: 4px;
  height: 33px;
  margin: 5px 2px;
}


.add:hover {
  /*background-color: #66666699;*/
}


.thumbnail {
  height: 33px;
  width: 33px;
  margin: 2px;
  border-radius: 4px;
}

.thumbnail img {
  /*max-height: 33px;*/
  max-width: 33px;
}

.main {
  position: relative
}

.expand-icon {
  border-radius: 2px;
  /*opacity: 0;*/
  transition: .3s background-color;
}

.expand-icon:hover {
  /*opacity: 1;*/
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
  right: 5px
}

.image-overlay-container {
  max-height: 100vh;
  overflow-y: auto;
  position: relative;
}

.image-overlay-container .close-icon {
  position: fixed;
  top: 15px;
  right: 15px
}

.overlay-thumbnail {
  transition: .4s transform, .4s opacity;
  opacity: .5;
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
  transition: .4s transform;
}

.modal-thumbnail-card:hover {
  transform: scale(1.05);
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
