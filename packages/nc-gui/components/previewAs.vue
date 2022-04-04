<template>
  <div>
    <v-menu offset-y>
      <template #activator="{on}">
        <v-btn
          v-show="isDashboard && _isUIAllowed('previewAs')"
          small
          light
          color="#fff3"
          class="white--text nc-btn-preview"
          v-on="on"
        >
          <v-icon small class="mr-1">
            mdi-play-circle
          </v-icon>
          Preview
          <v-icon small>
            mdi-menu-down
          </v-icon>
        </v-btn>
      </template>
      <v-list dense>
        <template v-for="(role) in rolesList">
          <v-list-item
            :key="role.title"
            :class="`pointer nc-preview-${role.title}`"
            @click="setPreviewUser(role.title)"
          >
            <v-list-item-title>
              <v-icon
                small
                class="mr-1"
                :color="role.title === previewAs ? 'x-active' : ''"
              >
                {{ roleIcon[role.title] }}
              </v-icon>
              <span
                class="caption text-capitalize"
                :class="{ 'x-active--text': role.title === previewAs }"
              >{{ role.title }}</span>
            </v-list-item-title>
          </v-list-item>
        </template>

        <template v-if="previewAs">
          <!--                <v-divider></v-divider>-->
          <v-list-item @click="setPreviewUser(null)">
            <v-icon small class="mr-1">
              mdi-close
            </v-icon>
            <!-- Reset Preview -->
            <span class="caption nc-preview-reset">{{ $t('activity.resetReview') }}</span>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>

    <v-menu
      :position-x="position.x"
      :position-y="position.y"
      :value="previewAs"
      activator=""
      :close-on-click="false"
      :close-on-content-click="false"
    >
      <div class="floating-reset-btn white py-1 pr-3 caption primary lighten-2 white--text font-weight-bold d-flex align-center nc-floating-preview-btn" style="overflow-y: hidden">
        <v-icon style="cursor: move" color="white" @mousedown="mouseDown">
          mdi-drag
        </v-icon>

        <v-divider vertical class="mr-2" />

        <div class="d-inline pointer d-flex align-center">
          <span>Preview as :</span>
          <v-radio-group
            :value="previewAs"
            dense
            row
            class="mt-0 pt-0"
            hide-details
            @change="setPreviewUser($event)"
          >
            <v-radio
              v-for="(role) in rolesList"
              :key="role.title"
              :value="role.title"
              color="white"
              dark
              :class="`ml-1 nc-floating-preview-${role.title}`"
            >
              <template #label>
                <span class="white--text caption text-capitalize">{{ role.title }}</span>
              </template>
            </v-radio>
          </v-radio-group>
          <v-divider vertical class="mr-2" />
          <span class="pointer" @click="setPreviewUser(null)"> <v-icon small color="white">mdi-exit-to-app</v-icon> Exit</span>
        </div>
      </div>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: 'PreviewAs',
  data: () => ({
    roleIcon: {
      owner: 'mdi-account-star',
      creator: 'mdi-account-hard-hat',
      editor: 'mdi-account-edit',
      viewer: 'mdi-eye-outline',
      commenter: 'mdi-comment-account-outline'
    },
    rolesList: [{ title: 'editor' }, { title: 'commenter' }, { title: 'viewer' }],
    position: {
      x: 9999, y: 9999
    }
  }),
  computed: {
    previewAs: {
      get() {
        return this.$store.state.users.previewAs
      },
      set(previewAs) {
        this.$store.commit('users/MutPreviewAs', previewAs)
      }
    }
  },
  mounted() {
    this.position = {
      y: window.innerHeight - 100,
      x: window.innerWidth / 2 - 250
    }

    window.addEventListener('mouseup', this.mouseUp, false)
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.divMove, true)
    window.removeEventListener('mouseup', this.mouseUp, false)
  },
  methods: {
    setPreviewUser(previewAs) {
      this.$tele.emit(`preview-as:${previewAs}`)
      if (!process.env.EE) {
        this.$toast.info('Available in Enterprise edition').goAway(3000)
      } else {
        this.previewAs = previewAs
        window.location.reload()
      }
    },
    mouseUp() {
      window.removeEventListener('mousemove', this.divMove, true)
    },
    mouseDown(e) {
      window.addEventListener('mousemove', this.divMove, true)
    },

    divMove(e) {
      this.position = { y: e.clientY - 10, x: e.clientX - 18 }
    }
  }
}
</script>

<style scoped>
</style>
