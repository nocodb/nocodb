<template>
  <div>
    <v-btn
      :loading="projectCreation"
      :disabled="projectCreation"
      class="primary nc-btn-use-template"
      x-large
      @click="useTemplate('rest')"
    >
      <slot>Use template</slot>
    </v-btn>
  </div>
</template>

<script>
import { SqlUiFactory } from 'nocodb-sdk';
import colors from '~/mixins/colors';

export default {
  name: 'CreateProjectFromTemplateBtn',
  mixins: [colors],
  props: {
    quickImport: Boolean,
    loading: Boolean,
    importToProject: Boolean,
    templateData: [Array, Object],
    importData: [Array, Object],
    valid: {
      default: true,
      type: Boolean,
    },
    validationErrorMsg: {
      default: 'Please fill all the required values',
      type: String,
    },
    createGqlText: {
      default: 'Create GQL Project',
      type: String,
    },
    createRestText: {
      default: 'Create REST Project',
      type: String,
    },
  },
  data() {
    return {
      localTemplateData: null,
      projectCreation: false,
      tableCreation: false,
      loaderMessagesIndex: 0,
      loaderMessages: [
        'Setting up new database configs',
        'Inferring database schema',
        'Generating APIs.',
        'Generating APIs..',
        'Generating APIs...',
        'Generating APIs....',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait',
        'Please wait.',
        'Please wait..',
        'Please wait...',
        'Please wait..',
        'Please wait.',
        'Please wait..',
        'Please wait...',
      ],
    };
  },
  watch: {
    templateData: {
      deep: true,
      handler(data) {
        this.localTemplateData = JSON.parse(JSON.stringify(data));
      },
    },
  },
  created() {
    this.localTemplateData = JSON.parse(JSON.stringify(this.templateData));
  },

  methods: {
    async useTemplate(projectType) {
      if (!this.valid) {
        return this.$toast.error(this.validationErrorMsg).goAway(3000);
      }

      // this.$emit('useTemplate', type)
      // this.projectCreation = true
      let interv;
      try {
        interv = setInterval(() => {
          this.loaderMessagesIndex =
            this.loaderMessagesIndex < this.loaderMessages.length - 1 ? this.loaderMessagesIndex + 1 : 6;
          this.$store.commit('loader/MutMessage', this.loaderMessages[this.loaderMessagesIndex]);
        }, 1000);

        const projectId = this.$store.state.project.project.id;
        let firstTable = null;

        // Not available now
        if (this.importToProject) {
          // this.$store.commit('loader/MutMessage', 'Importing excel template')
          // const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          //   // todo: extract based on active
          //   dbAlias: 'db', // this.nodes.dbAlias,
          //   env: '_noco'
          // }, 'xcModelsCreateFromTemplate', {
          //   template: this.templateData
          // }])
          // if (res && res.tables && res.tables.length) {
          //   this.$toast.success(`Imported ${res.tables.length} tables successfully`).goAway(3000)
          // } else {
          //   this.$toast.success('Template imported successfully').goAway(3000)
          // }
          // projectId = this.$route.params.project_id
          // prefix = this.$store.getters['project/GtrProjectPrefix']
        } else {
          // Create tables
          try {
            for (const t of this.localTemplateData.tables) {
              // enrich system fields if not provided
              // e.g. id, created_at, updated_at
              const systemColumns = SqlUiFactory.create({ client: this.$store.state.project.project.bases[0].type })
                .getNewTableColumns()
                .filter(c => c.column_name !== 'title');

              for (const systemColumn of systemColumns) {
                if (!t.columns.some(c => c.column_name.toLowerCase() === systemColumn.column_name.toLowerCase())) {
                  t.columns.push(systemColumn);
                }
              }

              // set pk & rqd if ID is provided
              for (const column of t.columns) {
                if (column.column_name.toLowerCase() === 'id' && !('pk' in column)) {
                  column.pk = true;
                  column.rqd = true;
                  break;
                }
              }

              // create table
              const table = await this.$api.dbTable.create(projectId, {
                table_name: t.table_name,
                title: '',
                columns: t.columns,
              });
              t.table_title = table.title;

              // open the first table after import
              if (firstTable === null) {
                firstTable = table;
              }

              // set primary value
              await this.$api.dbTableColumn.primaryColumnSet(table.columns[0].id);
            }
            this.tableCreation = true;
          } catch (e) {
            this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
            this.tableCreation = false;
          } finally {
            clearInterval(interv);
          }
        }

        if (!this.tableCreation) {
          // failed to create table
          return;
        }

        // Bulk import data
        if (this.importData) {
          this.$store.commit('loader/MutMessage', 'Importing excel data to project');
          await this.importDataToProject();
        }

        // reload table list
        this.$store
          .dispatch('project/_loadTables', {
            dbKey: '0.projectJson.envs._noco.db.0',
            key: '0.projectJson.envs._noco.db.0.tables',
            _nodes: {
              dbAlias: 'db',
              env: '_noco',
              type: 'tableDir',
            },
          })
          .then(() => {
            // add tab - choose the first one if multiple tables are created
            this.$store
              .dispatch('tabs/loadFirstCreatedTableTab', {
                title: firstTable.title,
              })
              .then(item => {
                // set active tab - choose the first one if multiple tables are created
                this.$nextTick(() => {
                  this.$router.push({
                    query: {
                      name: item.name || '',
                      dbalias: (item._nodes && item._nodes.dbAlias) || '',
                      type: (item._nodes && item._nodes.type) || 'table',
                    },
                  });
                });
              });
          });

        // confetti effect
        this.simpleAnim();
      } catch (e) {
        console.log(e);
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
      } finally {
        clearInterval(interv);
        this.$store.commit('loader/MutMessage', null);
        this.projectCreation = false;
        this.tableCreation = false;
        this.$emit('closeModal');
      }
    },
    async importDataToProject() {
      let total = 0;
      let progress = 0;
      const projectName = this.$store.state.project.project.title;
      await Promise.all(
        this.localTemplateData.tables.map(v =>
          (async tableMeta => {
            const tableName = tableMeta.table_title;
            const data = this.importData[tableMeta.ref_table_name];
            total += data.length;
            for (let i = 0; i < data.length; i += 500) {
              this.$store.commit('loader/MutMessage', `Importing data to ${projectName}: ${progress}/${total} records`);
              this.$store.commit('loader/MutProgress', Math.round(progress && (100 * progress) / total));
              const batchData = this.remapColNames(data.slice(i, i + 500), tableMeta.columns);
              await this.$api.dbTableRow.bulkCreate('noco', projectName, tableName, batchData);
              progress += batchData.length;
            }
            this.$store.commit('loader/MutClear');
          })(v)
        )
      );
    },
    remapColNames(batchData, columns) {
      return batchData.map(data =>
        (columns || []).reduce(
          (aggObj, col) => ({
            ...aggObj,
            [col.column_name]: data[col.ref_column_name || col.column_name],
          }),
          {}
        )
      );
    },
    simpleAnim() {
      const count = 200;
      const defaults = {
        origin: { y: 0.7 },
      };

      function fire(particleRatio, opts) {
        window.confetti(
          Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio),
          })
        );
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
      fire(0.2, {
        spread: 60,
      });
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    },
  },
};
</script>

<style scoped></style>
