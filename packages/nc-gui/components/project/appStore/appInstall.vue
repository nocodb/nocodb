<template>
  <v-container fluid class="textColor--text">
    <v-form v-model="valid">
      <template v-if="formDetails">
        <div class="title  d-flex align-center justify-center mb-4">
          <div
            v-if="plugin.logo"
            :style="{ background : plugin.title === 'SES' ? '#242f3e' : '' }"
            class="mr-1 d-flex align-center justify-center"
            :class="{ 'pa-2' : plugin.title === 'SES'}"
          >
            <img
              :src="plugin.logo"
              height="25"
            >
          </div>
          <v-icon
            v-else-if="plugin.icon"
            color="#242f3e"
            size="30"
            class="mr-1"
          >
            {{ plugin.icon }}
          </v-icon>

          <span @dblclick="copyDefault">{{ formDetails.title }}</span>
        </div>

        <v-divider class="mb-7" />
        <div v-if="formDetails.array">
          <table class="form-table mx-auto">
            <thead>
              <tr>
                <th v-for="(item,i) in formDetails.items" :key="i">
                  <label class="caption ">{{ item.label }} <span v-if="item.required" class="red--text">*</span></label>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(set,j) in settings" :key="j">
                <td v-for="(item,i) in formDetails.items" :key="i">
                  <form-input v-model="set[item.key]" :input-details="item" />
                </td>
                <td v-if="j">
                  <x-icon small icon-class="pointer" color="error" @click="settings.splice(j,1)">
                    mdi-delete-outline
                  </x-icon>
                </td>
              </tr>

              <tr>
                <td :colspan="formDetails.items.length" class="text-center">
                  <x-icon icon-class="pointer" @click="settings.push({})">
                    mdi-plus
                  </x-icon>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="d-flex justify-center">
          <div class="form-grid">
            <template v-for="(item,i) in formDetails.items">
              <div :key="i" class="text-right form-input-label">
                <label class="caption ">{{ item.label }} <span v-if="item.required" class="red--text">*</span></label>
              </div>
              <div :key="i">
                <form-input v-model="settings[item.key]" :input-details="item" />
              </div>
            </template>
          </div>
        </div>
        <div class="d-flex mb-4 mt-7 justify-center">
          <v-btn
            v-for="action in formDetails.actions"
            :key="action.key"
            small
            :outlined="action.key !== 'save'"
            :color="action.key === 'save' ? 'primary' : '' "
            :disabled="(action.key === 'save' && !valid) || (action.key === 'test' && testing)"
            :loading="action.key === 'test' && testing"
            @click="doAction(action)"
          >
            {{ action.label }}
          </v-btn>
        </div>
      </template>
    </v-form>
  </v-container>
</template>

<script>
import FormInput from '@/components/project/appStore/FormInput'

export default {
  name: 'AppInstall',
  components: { FormInput },
  props: ['id', 'defaultConfig'],
  data: () => ({
    plugin: null,
    formDetails: null,
    settings: null,
    pluginId: null,
    // title: null,
    valid: null,
    testing: false
  }),
  watch: {
    async id() {
      this.settings = {}
      await this.readPluginDetails()
    }
  },
  async created() {
    await this.readPluginDetails()
  },
  methods: {
    simpleAnim() {
      const count = 200
      const defaults = {
        origin: { y: 0.7 }
      }

      function fire(particleRatio, opts) {
        window.confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }))
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55
      })
      fire(0.2, {
        spread: 60
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45
      })
    },
    async saveSettings() {
      try {
        await this.$api.plugin.update(this.id, {
          input: JSON.stringify(this.settings),
          active: 1
        })

        this.$emit('saved')
        this.$toast.success(this.formDetails.msgOnInstall || 'Plugin settings saved successfully').goAway(5000)
        this.simpleAnim()
      } catch (_e) {
        const e = await this._extractSdkResponseError(_e)
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async testSettings() {
      this.testing = true
      try {
        // const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginTest', {
        //   input: this.settings,
        //   id: this.pluginId,
        //   category: this.plugin.category,
        //   title: this.plugin.title
        // }])
        const res = (await this.$api.plugin.test({
          input: this.settings,
          id: this.pluginId,
          category: this.plugin.category,
          title: this.plugin.title
        }))
        if (res) {
          this.$toast.success('Successfully tested plugin settings').goAway(3000)
        } else {
          this.$toast.info('Invalid credentials').goAway(3000)
        }
      } catch (_e) {
        const e = await this._extractSdkResponseError(_e)
        this.$toast[e.message === 'Not implemented' ? 'info' : 'error'](e.message).goAway(3000)
      }
      this.testing = false
    },
    async doAction(action) {
      switch (action.key) {
        case 'save' :
          await this.saveSettings()
          break
        case 'test' :
          await this.testSettings()
          break
        default:
          break
      }
    },
    async readPluginDetails() {
      try {
        // this.plugin = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginRead', {
        //   title: this.title
        // }])
        this.plugin = (await this.$api.plugin.read(this.id))
        this.formDetails = JSON.parse(this.plugin.input_schema)
        this.pluginId = this.plugin.id
        this.settings = JSON.parse(this.plugin.input) || (this.formDetails.array ? [{}] : {})
      } catch (e) {
      }
    },
    copyDefault() {
      if (this.plugin.title.replace(/\s/g, '_').toLowerCase() in this.defaultConfig) {
        const data = this.defaultConfig[this.plugin.title.replace(/\s/g, '_').toLowerCase()]
        this.settings = JSON.parse(JSON.stringify(data))
        this.$toast.info('Demo credentials added').goAway(3000)
      }
    }

  }
}
</script>

<style scoped lang="scss">

::v-deep {
  //input,
  //select,
  //textarea {
  //  border: 1px solid #7f828b33;
  //  padding: 1px 5px;
  //  font-size: .8rem;
  //  border-radius: 4px;
  //
  //  &:focus {
  //    border: 1px solid var(--v-primary-base);
  //  }
  //
  //  &:hover:not(:focus) {
  //    box-shadow: 0 0 2px dimgrey;
  //  }
  //}
  //
  //
  //input, textarea {
  //  min-width: 300px;
  //}
}

.form-grid {
  display: grid;
  grid-template-columns:auto auto;
  column-gap: 10px;
  row-gap: 20px;
  align-items: center;
}

.form-table {
  border: none;
  min-width: 400px;
}

tbody tr:nth-of-type(odd) {
  background-color: transparent;
}

</style>
