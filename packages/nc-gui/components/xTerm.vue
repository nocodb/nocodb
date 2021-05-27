<template>
  <div>

    <v-progress-linear
      v-show="loading"
      color="success"
      indeterminate
      absolute
      height="4"
    ></v-progress-linear>

    <v-tabs
      style="height: 100%"
      v-model="tab"
      height="40">
      <v-tab
        class="caption"
        v-for="(n,i) in terminals"
        :key="n">
        <span @dblclick="dblClick"> Local ({{ i + 1 }})</span>
        <v-icon v-if="terminals.length > 1" class="ml-2 grey--text text--lighten-1" small
                @click.native.stop="closeTerminal(i)">mdi-close
        </v-icon>
      </v-tab>

      <x-icon class="mx-2" @click="addTerminal" small>mdi-plus</x-icon>
      <span v-shortkey="['meta','t']" @shortkey="addTerminal"></span>
      <span v-if="isModal" v-shortkey="['meta','w']" @shortkey="terminals.length && closeTerminal(tab)"></span>


      <div class="flex-grow-1 d-flex text-right pr-4 justify-end " v-if="!isDocker">


        <x-icon iconClass="mr-4"
                v-if="_isWindows"
                :disabled="loading"
                @click="setExecutionPolicy()"
                tooltip="Set-ExecutionPolicy"
                color="success success">
          mdi-consolidate
        </x-icon>


        <template v-if="!isNoApis">
          <x-icon iconClass="mr-4" v-if="isDashboard && !isGraphql"
                  :disabled="loading"
                  @click="runXcGenApisRest()"
                  tooltip="Generate REST Code (^ ⇧ M)"
                  color="success success">
            {{isTsEnabled ? 'mdi-language-typescript' : 'mdi-language-javascript'}}
          </x-icon>
          <span v-shortkey="['ctrl','shift','m']" v-if="isDashboard" @shortkey="runXcGenApisRest()"></span>

          <x-icon iconClass="mr-4"
                  :disabled="loading"
                  v-if="isDashboard && isGraphql"
                  @click="runXcGenApisGql()"
                  color="pink pink"
                  tooltip="Generate GraphQL Code (^ ⇧ Q)">
            {{isTsEnabled ? 'mdi-language-typescript' : 'mdi-language-javascript'}}
          </x-icon>

          <span v-shortkey="['ctrl','shift','q']" v-if="isDashboard" @shortkey="runXcGenApisGql()"></span>

          <x-icon iconClass="mr-4"
                  :disabled="loading"
                  v-if="isDashboard && showDelete"
                  @click="codeClear()"
                  color="error error"
                  tooltip="Delete all code (^ ⇧ C)">
            mdi-delete-variant
          </x-icon>
          <span v-shortkey="['ctrl','shift','c']" v-if="isDashboard" @shortkey="codeClear()"></span>


          <x-icon iconClass="mr-4"
                  :disabled="loading"
                  size="30"
                  v-if="isDashboard"
                  @click="runNpmInstall()"
                  color="error error"
                  tooltip="npm install (^ ⇧ I)">
            mdi-npm
          </x-icon>
          <span v-shortkey="['ctrl','shift','i']" v-if="isDashboard" @shortkey="runNpmInstall()"></span>

          <x-icon color="success success"
                  :disabled="loading"
                  tooltip="Run Command (^ ⇧ R)"
                  icon-class="mr-2"
                  size="29"
                  @click="runScript">
            mdi-play
          </x-icon>
          <span v-shortkey="['ctrl','shift','r']" v-if="isDashboard" @shortkey="runScript()"></span>

          <x-icon color="red red"
                  :disabled="loading"
                  tooltip="Stop Command (^ ⇧ S)"
                  icon-class="mr-2"
                  @click="stopScript">
            mdi-stop
          </x-icon>
          <span v-shortkey="['ctrl','shift','s']" v-if="isDashboard" @shortkey="stopScript()"></span>

          <x-icon color="info info"
                  :disabled="loading"
                  tooltip="Clear (^ ⇧ E)"
                  icon-class="mr-2"
                  @click="clearScript">
            mdi-notification-clear-all
          </x-icon>
          <span v-shortkey="['ctrl','shift','e']" v-if="isDashboard" @shortkey="stopScript()"></span>
          <v-tooltip bottom>
            <template v-slot:activator="{on}">
              <img height="24" v-on="on" class="mt-2 mr-2 pointer" @click="installCliTool" src="~/assets/img/brand/favicon-64.png">
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
              <template v-slot:selection="{item}">
                      <span
                        style="text-transform: uppercase">{{item}}</span>&nbsp; <span class="grey--text">(env)</span>
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
        <div style="height:100%" :key="i" ref="term" class="terminal-window">
        </div>
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script>
  import {Terminal} from 'xterm';
  import XIcon from "./global/xIcon";
  import {FitAddon} from 'xterm-addon-fit';
  import {WebLinksAddon} from 'xterm-addon-web-links';
  import {mapGetters} from "vuex";


  export default {
    name: "xTerm",
    components: {XIcon},
    props: {
      isModal: {
        default: false,
        type: Boolean
      }
    },
    computed: {
      ...mapGetters({
        currentProjectFolder: "project/currentProjectFolder",
        sqlMgr: "sqlMgr/sqlMgr",
        phql: "project/GtrProjectIsGraphql",
        isNoApis: "project/GtrProjectIsNoApis",
          isDocker: 'project/GtrIsDocker',
      }),
      isTsEnabled() {
        // return process.env.TS_ENABLED;
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
        showDelete: false,
      }
    },
    methods: {
      dblClick() {
        // this.showDelete = true;
        // this.$set(process.env, 'TS_ENABLED', process.env.TS_ENABLED ? '' : '1')
      }, async setExecutionPolicy() {
        // if (!this._isWindows) return
        // try {
        //   let {ptyProc} = this.termRef[this.tab];
        //   ptyProc.write(`${ptyProc.process === 'node' ? '\u0003\n\r' : ''}Set-ExecutionPolicy "Bypass";\n\r`)
        // } catch (e) {
        //   console.log(e)
        // }
      },
      async handleKeyDown(event) {
        // switch ([this._isMac ? event.metaKey : event.ctrlKey, event.key].join('_')) {
        //   case 'true_w' :
        //     event.preventDefault();
        //     event.stopPropagation();
        //     if (this.termRef.length > 0) {
        //       if (!this.isModal)
        //         this.closeTerminal(this.tab);
        //       return true;
        //     }
        //     break;
        // }
        // return false;
      },

      async codeGenerateMvc() {
        this.loading = true;
        // try {
        //   await this.setExecutionPolicy();
        //   await this.sqlMgr.projectGenerateBackend({
        //     env: 'dev',
        //   });
        //   this.$toast.info('Yay, code generated').goAway(4000);
        //   this.runNpmInstall()
        //   this.runScript()
        // } catch (e) {
        //   this.$toast.error('Error generating REST APIs code :' + e).goAway(4000);
        //   throw e;
        // } finally {
        //   this.loading = false;
        // }
      },
      async codeGenerateMvcGql() {
        this.loading = true;
        // try {
        //   await this.sqlMgr.projectGenerateBackendGql({
        //     env: 'dev',
        //   });
        //   this.$toast.info('Yay, GraphQL with MVC generated').goAway(4000);
        //   this.runNpmInstall()
        //   this.runScript()
        //
        // } catch (e) {
        //   this.$toast.error('Error generating GraphQL code :' + e).goAway(4000);
        //   throw e;
        // } finally {
        //   this.loading = false;
        // }
      },
      async codeClear() {
        this.loading = true;
        // try {
        //   await this.setExecutionPolicy();
        //   await this.sqlMgr.projectGeneratedCodeClear({
        //     env: 'dev',
        //   });
        //   this.$toast.info('Yay, code cleared').goAway(4000);
        // } catch (e) {
        //   this.$toast.error('Error generating GraphQL code :' + e).goAway(4000);
        //   throw e;
        // } finally {
        //   this.loading = false;
        // }
      },

      runXcGenApisRest() {
        // this.setExecutionPolicy();
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`${ptyProc.process === 'node' ? '\u0003\n\r' : ''}cd ${this.currentProjectFolder};\n\rxc gen.apis.rest;\n\r`)
      },

      runXcGenApisGql() {
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`${ptyProc.process === 'node' ? '\u0003\n\r' : ''}cd ${this.currentProjectFolder};\n\rxc gen.apis.graphql;\n\r`)
      },

      runNpmInstall() {
        let {client} = this.termRef[this.tab];
        client.emit('req', `\n\rnpm install;\n\r`)
      },

      runScript() {
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`${ptyProc.process === 'node' ? '\u0003\n\r' : ''}cd ${this.currentProjectFolder};\n\rnpm run ${this.selectedScript || 'dev'};\n\r`)
      },
      stopScript() {
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`\u0003\n\r`)
      },
      clearScript() {
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`clear\n\r`)
      },
      installCliTool() {
        // let {ptyProc} = this.termRef[this.tab];
        // ptyProc.write(`npm install -g xc-cli\n\r`)
      },
      addTerminal() {
        if (this.terminals.length > 4) {
          this.$toast.info('Only 5 terminals can be opened').goAway();
          return;
        }
        this.terminals.push(Date.now());
        this.tab = this.terminals.length - 1;
        this.$nextTick(() => {
          this.initTerminal(this.$refs.term[this.terminals.length - 1], this.terminals.length - 1);
        })
      },

      initTerminal($el, index) {
        try {


          // todo: change to hostname
          const client = require('socket.io-client')(`http://localhost:8081`);


          const term = new Terminal({
            theme: {
              background: 'black',
              foreground: 'green'
            }
          });

          term.loadAddon(new WebLinksAddon((e, url) => {
            e.preventDefault();
            console.log(url)
          }));
          // //
          // //
          const fitAddon = new FitAddon();
          term.loadAddon(fitAddon);
          // //
          term.open($el);
          // //
          fitAddon.fit();
          //
          //   const ligaturesAddon = new LigaturesAddon();
          //   term.loadAddon(ligaturesAddon)
          //
          //   fixPath();
          //
          //   const ptyProc = pty.spawn(os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash', [], {
          //     cols: term.cols,
          //     rows: term.rows,
          //     cwd: this.currentProjectFolder || process.env.HOME,
          //     env: process.env
          //   });
          //
          term.onData((data) => {
            console.log(data)
            client.emit('req', data)
            // term.write(data.replace(/\n/, '\r\n'));
          });


          client.on('res', (data) => {
            term.write(`${data}`);
          });


          //   ptyProc.onData(data => {
          //     term.write(data);
          //   });
          //
          term.focus();
          //
          this.termRef[index] = {
            term,
            client
          };
        } catch (e) {
          this.$toast.error('Error opening the terminal\n\nPlease use your system terminal').goAway(5000)
        }
      },
      closeTerminal(index) {
        console.log('======= close terminal')
        try {
          const proc = this.termRef.splice(index, 1)[0];
          proc.term.dispose();
          proc.client.off();
          proc.client.disconnect();
          this.terminals.splice(index, 1)
        } catch (e) {
          console.log(e)
          throw e;
        }
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
        this.initTerminal(this.$refs.term[0], 0);
      }, 200);
    },
    destroyed() {
      let l = this.terminals.length;
      while (l--)
        this.closeTerminal(l);
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
