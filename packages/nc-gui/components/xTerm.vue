<template>
  <div>
    <v-progress-linear
      v-show="loading"
      color="success"
      indeterminate
      absolute
      height="4"
    />

    <v-tabs
      v-model="tab"
      style="height: 100%"
      height="40"
    >
      <v-tab
        v-for="(n,i) in terminals"
        :key="n"
        class="caption"
      >
        <span @dblclick="dblClick"> Local ({{ i + 1 }})</span>
        <v-icon
          v-if="terminals.length > 1"
          class="ml-2 grey--text text--lighten-1"
          small
          @click.native.stop="closeTerminal(i)"
        >
          mdi-close
        </v-icon>
      </v-tab>

      <x-icon class="mx-2" small @click="addTerminal">
        mdi-plus
      </x-icon>
      <span v-shortkey="['meta','t']" @shortkey="addTerminal" />
      <span v-if="isModal" v-shortkey="['meta','w']" @shortkey="terminals.length && closeTerminal(tab)" />

      <div v-if="!isDocker" class="flex-grow-1 d-flex text-right pr-4 justify-end ">
        <x-icon
          v-if="_isWindows"
          icon-class="mr-4"
          :disabled="loading"
          tooltip="Set-ExecutionPolicy"
          color="success success"
          @click="setExecutionPolicy()"
        >
          mdi-consolidate
        </x-icon>

        <template v-if="!isNoApis">
          <x-icon
            v-if="isDashboard && !isGraphql"
            icon-class="mr-4"
            :disabled="loading"
            tooltip="Generate REST Code (^ ⇧ M)"
            color="success success"
            @click="runXcGenApisRest()"
          >
            {{ isTsEnabled ? 'mdi-language-typescript' : 'mdi-language-javascript' }}
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','m']" @shortkey="runXcGenApisRest()" />

          <x-icon
            v-if="isDashboard && isGraphql"
            icon-class="mr-4"
            :disabled="loading"
            color="pink pink"
            tooltip="Generate GraphQL Code (^ ⇧ Q)"
            @click="runXcGenApisGql()"
          >
            {{ isTsEnabled ? 'mdi-language-typescript' : 'mdi-language-javascript' }}
          </x-icon>

          <span v-if="isDashboard" v-shortkey="['ctrl','shift','q']" @shortkey="runXcGenApisGql()" />

          <x-icon
            v-if="isDashboard && showDelete"
            icon-class="mr-4"
            :disabled="loading"
            color="error error"
            tooltip="Delete all code (^ ⇧ C)"
            @click="codeClear()"
          >
            mdi-delete-variant
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','c']" @shortkey="codeClear()" />

          <x-icon
            v-if="isDashboard"
            icon-class="mr-4"
            :disabled="loading"
            size="30"
            color="error error"
            tooltip="npm install (^ ⇧ I)"
            @click="runNpmInstall()"
          >
            mdi-npm
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','i']" @shortkey="runNpmInstall()" />

          <x-icon
            color="success success"
            :disabled="loading"
            tooltip="Run Command (^ ⇧ R)"
            icon-class="mr-2"
            size="29"
            @click="runScript"
          >
            mdi-play
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','r']" @shortkey="runScript()" />

          <x-icon
            color="red red"
            :disabled="loading"
            tooltip="Stop Command (^ ⇧ S)"
            icon-class="mr-2"
            @click="stopScript"
          >
            mdi-stop
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','s']" @shortkey="stopScript()" />

          <x-icon
            color="info info"
            :disabled="loading"
            tooltip="Clear (^ ⇧ E)"
            icon-class="mr-2"
            @click="clearScript"
          >
            mdi-notification-clear-all
          </x-icon>
          <span v-if="isDashboard" v-shortkey="['ctrl','shift','e']" @shortkey="stopScript()" />
          <v-tooltip bottom>
            <template #activator="{on}">
              <img height="24" class="mt-2 mr-2 pointer" src="~/assets/img/brand/favicon-64.png" v-on="on" @click="installCliTool">
            </template>
            Installs NocoDB CLI<br>( npm install -g xc-cli )
          </v-tooltip>

          <div class="flex-shrink-1 ">
            <v-select
              v-model="selectedScript"
              height="32"
              class="caption envs"
              dense
              :items="scripts"
              placeholder="package.json"
              single-line
              outlined
            >
              <template #selection="{item}">
                <span
                  style="text-transform: uppercase"
                >{{ item }}</span>&nbsp; <span class="grey--text">(env)</span>
              </template>

              <!--            <template v-slot:prepend-outer>-->
              <!--       -->
              <!--            </template>-->
            </v-select>
          </div>
        </template>
      </div>

      <v-tab-item
        v-for="i in terminals"
        :key="i"
      >
        <div :key="i" ref="term" style="height:100%" class="terminal-window" />
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script>
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { mapGetters } from 'vuex'
import XIcon from './global/xIcon'

export default {
  name: 'XTerm',
  components: { XIcon },
  props: {
    isModal: {
      default: false,
      type: Boolean
    }
  },
  computed: {
    ...mapGetters({
      currentProjectFolder: 'project/currentProjectFolder',
      sqlMgr: 'sqlMgr/sqlMgr',
      phql: 'project/GtrProjectIsGraphql',
      isNoApis: 'project/GtrProjectIsNoApis',
      isDocker: 'project/GtrIsDocker'
    }),
    isTsEnabled() {
      return false // return process.env.TS_ENABLED;
    }
  },
  data() {
    return {
      tab: 0,
      terminals: [Date.now()],
      termRef: [],
      scripts: [],
      selectedScript: null,
      loading: false,
      showDelete: false
    }
  },
  async mounted() {
    // try {
    //   const packageData = await jsonfile.readFileSync(path.join(this.currentProjectFolder, 'package.json'));
    //   this.scripts = Object.keys(packageData.scripts);
    // } catch (e) {
    //   console.log('package============', e)
    // }

    setTimeout(() => {
      this.initTerminal(this.$refs.term[0], 0)
    }, 200)
  },
  destroyed() {
    let l = this.terminals.length
    while (l--) { this.closeTerminal(l) }
  },
  methods: {
    dblClick() {
    },
    async setExecutionPolicy() {
    },
    async handleKeyDown(event) {
    },

    async codeGenerateMvc() {
      this.loading = true
    },
    async codeGenerateMvcGql() {
      this.loading = true
    },
    async codeClear() {
      this.loading = true
    },

    runXcGenApisRest() {
    },

    runXcGenApisGql() {
    },

    runNpmInstall() {
      const { client } = this.termRef[this.tab]
      client.emit('req', '\n\rnpm install;\n\r')
    },

    runScript() {
    },
    stopScript() {
    },
    clearScript() {
    },
    installCliTool() {
    },
    addTerminal() {
      if (this.terminals.length > 4) {
        this.$toast.info('Only 5 terminals can be opened').goAway()
        return
      }
      this.terminals.push(Date.now())
      this.tab = this.terminals.length - 1
      this.$nextTick(() => {
        this.initTerminal(this.$refs.term[this.terminals.length - 1], this.terminals.length - 1)
      })
    },

    initTerminal($el, index) {
      try {
        // todo: change to hostname
        const client = require('socket.io-client')('http://localhost:8081')

        const term = new Terminal({
          theme: {
            background: 'black',
            foreground: 'green'
          }
        })

        term.loadAddon(new WebLinksAddon((e, url) => {
          e.preventDefault()
        }))
        // //
        // //
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        // //
        term.open($el)
        // //
        fitAddon.fit()
        term.onData((data) => {
          client.emit('req', data)
        })

        client.on('res', (data) => {
          term.write(`${data}`)
        })
        term.focus()
        //
        this.termRef[index] = {
          term,
          client
        }
      } catch (e) {
        this.$toast.error('Error opening the terminal\n\nPlease use your system terminal').goAway(5000)
      }
    },
    closeTerminal(index) {
      try {
        const proc = this.termRef.splice(index, 1)[0]
        proc.term.dispose()
        proc.client.off()
        proc.client.disconnect()
        this.terminals.splice(index, 1)
      } catch (e) {
        console.log(e)
        throw e
      }
    }
  }
}
</script>

<style scoped>
  /deep/ .v-tabs-items {
    height: calc(100% - 40px);
  }

  /deep/ .v-window__container {
    height: 100%;
  }

  /deep/ .v-window__container .v-window-item {
    height: 100%;
  }

  /deep/ .terminal-window > div {
    padding: 0 5px;
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
