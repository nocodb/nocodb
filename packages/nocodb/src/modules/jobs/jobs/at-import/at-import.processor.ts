import moment from 'moment';
import { UITypes } from 'nocodb-sdk';
import Airtable from 'airtable';
import hash from 'object-hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tinycolor from 'tinycolor2';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { isLinksOrLTAR } from 'nocodb-sdk';
import debug from 'debug';
import { JobsLogService } from '../jobs-log.service';
import FetchAT from './helpers/fetchAT';
import { importData, importLTARData } from './helpers/readAndProcessData';
import EntityMap from './helpers/EntityMap';
import type { UserType } from 'nocodb-sdk';
import type { Base } from '~/models';
import { sanitizeColumnName } from '~/helpers';
import { AttachmentsService } from '~/services/attachments.service';
import { ColumnsService } from '~/services/columns.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { FiltersService } from '~/services/filters.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { GalleriesService } from '~/services/galleries.service';
import { GridsService } from '~/services/grids.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { BasesService } from '~/services/bases.service';
import { SortsService } from '~/services/sorts.service';
import { TablesService } from '~/services/tables.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewsService } from '~/services/views.service';
import { FormsService } from '~/services/forms.service';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { GridColumnsService } from '~/services/grid-columns.service';
import { TelemetryService } from '~/services/telemetry.service';

dayjs.extend(utc);

const selectColors = {
  // normal
  blue: '#cfdfff',
  cyan: '#d0f0fd',
  teal: '#c2f5e9',
  green: '#d1f7c4',
  orange: '#fee2d5',
  yellow: '#ffeab6',
  red: '#ffdce5',
  pink: '#ffdaf6',
  purple: '#ede2fe',
  gray: '#eee',
  // medium
  blueMedium: '#9cc7ff',
  cyanMedium: '#77d1f3',
  tealMedium: '#72ddc3',
  greenMedium: '#93e088',
  orangeMedium: '#ffa981',
  yellowMedium: '#ffd66e',
  redMedium: '#ff9eb7',
  pinkMedium: '#f99de2',
  purpleMedium: '#cdb0ff',
  grayMedium: '#ccc',
  // dark
  blueDark: '#2d7ff9',
  cyanDark: '#18bfff',
  tealDark: '#20d9d2',
  greenDark: '#20c933',
  orangeDark: '#ff6f2c',
  yellowDark: '#fcb400',
  redDark: '#f82b60',
  pinkDark: '#ff08c2',
  purpleDark: '#8b46ff',
  grayDark: '#666',
  // darker
  blueDarker: '#2750ae',
  cyanDarker: '#0b76b7',
  tealDarker: '#06a09b',
  greenDarker: '#338a17',
  orangeDarker: '#d74d26',
  yellowDarker: '#b87503',
  redDarker: '#ba1e45',
  pinkDarker: '#b2158b',
  purpleDarker: '#6b1cb0',
  grayDarker: '#444',
};

@Processor(JOBS_QUEUE)
export class AtImportProcessor {
  private readonly debugLog = debug('nc:jobs:at-import');

  constructor(
    private readonly tablesService: TablesService,
    private readonly viewsService: ViewsService,
    private readonly basesService: BasesService,
    private readonly attachmentsService: AttachmentsService,
    private readonly columnsService: ColumnsService,
    private readonly filtersService: FiltersService,
    private readonly formColumnsService: FormColumnsService,
    private readonly formsService: FormsService,
    private readonly galleriesService: GalleriesService,
    private readonly gridsService: GridsService,
    private readonly baseUsersService: BaseUsersService,
    private readonly viewColumnsService: ViewColumnsService,
    private readonly sortsService: SortsService,
    private readonly bulkDataAliasService: BulkDataAliasService,
    private readonly jobsLogService: JobsLogService,
    private readonly gridColumnService: GridColumnsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  @Process(JobTypes.AtImport)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const syncDB = job.data;

    const sMapEM = new EntityMap('aTblId', 'ncId', 'ncName', 'ncParent');
    await sMapEM.init();
    const userRole = syncDB.user.roles
      .split(',')
      .reduce((rolesObj, role) => ({ [role]: true, ...rolesObj }));

    const sMap = {
      // static mapping records between aTblId && ncId
      async addToMappingTbl(aTblId, ncId, ncName, ncParent?) {
        await sMapEM.addRow({ aTblId, ncId, ncName, ncParent });
      },

      // get NcID from airtable ID
      async getNcIdFromAtId(aId) {
        return (await sMapEM.getRow('aTblId', aId, ['ncId']))?.ncId;
      },

      // get nc Parent from airtable ID
      async getNcParentFromAtId(aId) {
        return (await sMapEM.getRow('aTblId', aId, ['ncParent']))?.ncParent;
      },

      // get nc-title from airtable ID
      async getNcNameFromAtId(aId) {
        return (await sMapEM.getRow('aTblId', aId, ['ncName']))?.ncName;
      },
    };

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const logDetailed = (log) => {
      if (debugMode) this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const perfStats = [];

    const recordPerfStart = () => {
      if (!debugMode) return 0;
      return Date.now();
    };

    const recordPerfStats = (start, event) => {
      if (!debugMode) return;
      const duration = Date.now() - start;
      perfStats.push({ d: duration, e: event });
    };

    let atBase, atBaseId;
    const start = Date.now();
    const enableErrorLogs = false;
    const generate_migrationStats = true;
    const debugMode = false;
    let g_aTblSchema = [];
    let ncCreatedProjectSchema: Partial<Base> = {};
    const ncLinkMappingTable: any[] = [];
    const nestedLookupTbl: any[] = [];
    const nestedRollupTbl: any[] = [];
    const ncSysFields = { id: 'ncRecordId', hash: 'ncRecordHash' };
    const storeLinks = false;
    const ncLinkDataStore: any = {};
    const insertedAssocRef: any = {};

    const atNcAliasRef: {
      [ncTableId: string]: {
        [ncTitle: string]: string;
      };
    } = {};

    const uniqueTableNameGen = getUniqueNameGenerator('sheet');

    // run time counter (statistics)
    const rtc = {
      sort: 0,
      filter: 0,
      view: {
        total: 0,
        grid: 0,
        gallery: 0,
        form: 0,
      },
      fetchAt: {
        count: 0,
        time: 0,
      },
      migrationSkipLog: {
        count: 0,
        log: [],
      },
      data: {
        records: 0,
        nestedLinks: 0,
      },
    };

    const updateMigrationSkipLog = (tbl, col, type, reason?) => {
      rtc.migrationSkipLog.count++;
      rtc.migrationSkipLog.log.push(
        `tn[${tbl}] cn[${col}] type[${type}] :: ${reason}`,
      );
    };

    // mapping table
    //

    const getAirtableSchema = async (sDB) => {
      const start = Date.now();

      if (!sDB.shareId)
        throw {
          message:
            'Invalid Shared Base ID :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
        };

      if (sDB.shareId.startsWith('exp')) {
        const template = await FetchAT.readTemplate(sDB.shareId);
        await FetchAT.initialize(template.template.exploreApplication.shareId);
      } else {
        await FetchAT.initialize(sDB.shareId, sDB.appId);
      }
      const ft = await FetchAT.read();
      const duration = Date.now() - start;
      rtc.fetchAt.count++;
      rtc.fetchAt.time += duration;

      if (!ft.baseId) {
        throw {
          message:
            'Invalid Shared Base ID :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
        };
      }

      const file = ft.schema;
      atBaseId = ft.baseId;
      atBase = new Airtable({ apiKey: sDB.apiKey }).base(atBaseId);
      // store copy of airtable schema globally
      g_aTblSchema = file.tableSchemas;

      return file;
    };

    const getViewData = async (viewId) => {
      const start = Date.now();
      const ft = await FetchAT.readView(viewId);
      const duration = Date.now() - start;
      rtc.fetchAt.count++;
      rtc.fetchAt.time += duration;

      return ft.view;
    };

    const getRootDbType = () => {
      return ncCreatedProjectSchema?.sources.find(
        (el) => el.id === syncDB.sourceId,
      )?.type;
    };

    // base mapping table
    const aTblNcTypeMap = {
      foreignKey: UITypes.Links,
      text: UITypes.SingleLineText,
      multilineText: UITypes.LongText,
      richText: UITypes.LongText,
      multipleAttachment: UITypes.Attachment,
      checkbox: UITypes.Checkbox,
      multiSelect: UITypes.MultiSelect,
      select: UITypes.SingleSelect,
      collaborator: UITypes.Collaborator,
      multiCollaborator: UITypes.Collaborator,
      date: UITypes.Date,
      phone: UITypes.PhoneNumber,
      number: UITypes.Decimal,
      rating: UITypes.Rating,
      formula: UITypes.Formula,
      rollup: UITypes.Rollup,
      count: UITypes.Count,
      lookup: UITypes.Lookup,
      autoNumber: UITypes.AutoNumber,
      barcode: UITypes.SingleLineText,
      button: UITypes.Button,
    };

    //-----------------------------------------------------------------------------
    // aTbl helper routines
    //

    const nc_getSanitizedColumnName = (table, name) => {
      let col_name = sanitizeColumnName(name);

      // truncate to 50 chars if character if exceeds above 50
      col_name = col_name?.slice(0, 50);

      // for knex, replace . with _
      let col_alias = name.trim().replace(/\./g, '_');

      // check if already a column exists with same name?
      const duplicateTitle = table.columns.find(
        (x) => x.title?.toLowerCase() === col_alias?.toLowerCase(),
      );
      const duplicateColumn = table.columns.find(
        (x) => x.column_name?.toLowerCase() === col_name?.toLowerCase(),
      );

      if (duplicateTitle) {
        let tempAlias = col_alias;
        let suffix = 1;
        while (
          table.columns.find(
            (x) => x.title?.toLowerCase() === tempAlias?.toLowerCase(),
          )
        ) {
          tempAlias = col_alias;
          tempAlias += `_${suffix++}`;
        }
        col_alias = tempAlias;
      }

      if (duplicateColumn) {
        let tempName = col_name;
        let suffix = 1;
        while (
          table.columns.find(
            (x) => x.column_name?.toLowerCase() === tempName?.toLowerCase(),
          )
        ) {
          tempName = col_name;
          tempName += `_${suffix++}`;
        }
        col_name = tempName;
      }

      return {
        title: col_alias,
        column_name: col_name,
      };
    };

    const ncSchema = {
      tables: [],
      tablesById: {},
    };

    // aTbl: retrieve column name from column ID
    //
    const aTbl_getColumnName = (colId): any => {
      for (let i = 0; i < g_aTblSchema.length; i++) {
        const sheetObj = g_aTblSchema[i];
        const column = sheetObj.columns.find((col) => col.id === colId);
        if (column !== undefined)
          return {
            tn: sheetObj.name,
            cn: column.name,
          };
      }
    };

    // retrieve nc column schema from using aTbl field ID as reference
    //
    const nc_getColumnSchema = async (aTblFieldId) => {
      const ncTblId = await sMap.getNcParentFromAtId(aTblFieldId);
      const ncColId = await sMap.getNcIdFromAtId(aTblFieldId);

      // not migrated column, skip
      if (ncColId === undefined || ncTblId === undefined) return 0;

      return ncSchema.tablesById[ncTblId].columns.find((x) => x.id === ncColId);
    };

    // retrieve nc table schema using table name
    // optimize: create a look-up table & re-use information
    //
    const nc_getTableSchema = async (tableName) => {
      return ncSchema.tables.find((x) => x.title === tableName);
    };

    // map UIDT
    //
    const getNocoType = (col) => {
      // start with default map
      let ncType = aTblNcTypeMap[col.type];

      // types email & url are marked as text
      // types currency & percent, duration are marked as number
      // types createTime & modifiedTime are marked as formula

      switch (col.type) {
        case 'text':
          if (col.typeOptions?.validatorName === 'email')
            ncType = UITypes.Email;
          else if (col.typeOptions?.validatorName === 'url')
            ncType = UITypes.URL;
          break;

        case 'number':
          // kludge: currency validation error with decimal places
          if (col.typeOptions?.format === 'percentV2') ncType = UITypes.Percent;
          else if (col.typeOptions?.format === 'duration')
            ncType = UITypes.Duration;
          else if (col.typeOptions?.format === 'currency')
            ncType = UITypes.Currency;
          else if (col.typeOptions?.precision > 0) ncType = UITypes.Decimal;
          break;

        case 'formula':
          if (col.typeOptions?.formulaTextParsed === 'CREATED_TIME()')
            ncType = UITypes.DateTime;
          else if (
            col.typeOptions?.formulaTextParsed === 'LAST_MODIFIED_TIME()'
          )
            ncType = UITypes.DateTime;
          break;

        case 'computation':
          if (col.typeOptions?.resultType === 'collaborator')
            ncType = UITypes.Collaborator;
          break;

        case 'date':
          if (col.typeOptions?.isDateTime) ncType = UITypes.DateTime;
          break;
      }

      return ncType;
    };

    // retrieve additional options associated with selected data types
    //
    const getNocoTypeOptions = async (col: any): Promise<any> => {
      switch (col.type) {
        case 'select':
        case 'multiSelect': {
          // prepare options list in CSV format
          // note: NC doesn't allow comma's in options
          //
          const options = [];
          let order = 1;
          for (const [, value] of Object.entries(col.typeOptions.choices)) {
            // replace commas with dot for multiselect
            if (col.type === 'multiSelect') {
              (value as any).name = (value as any).name.replace(/,/g, '.');
            }
            // we don't allow empty records, placeholder instead
            if ((value as any).name === '') {
              (value as any).name = 'nc_empty';
            }
            // enumerate duplicates (we don't allow them)
            // TODO fix record mapping (this causes every record to map first option,
            //  we can't handle them using data api as they don't provide option id
            //  within data we might instead get the correct mapping from schema file )
            let dupNo = 1;
            const defaultName = (value as any).name;
            while (
              options.find(
                (el) =>
                  el.title.toLowerCase() === (value as any).name.toLowerCase(),
              )
            ) {
              (value as any).name = `${defaultName}_${dupNo++}`;
            }
            options.push({
              order: order++,
              title: (value as any).name,
              color: selectColors[(value as any).color]
                ? selectColors[(value as any).color]
                : tinycolor.random().toHexString(),
            });

            await sMap.addToMappingTbl(
              (value as any).id,
              undefined,
              (value as any).name,
            );
          }
          return { type: col.type, data: options };
        }
        default:
          return { type: undefined };
      }
    };

    // convert to Nc schema (basic, excluding relations)
    //
    const tablesPrepare = async (tblSchema: any[]) => {
      const tables: any[] = [];

      for (let i = 0; i < tblSchema.length; ++i) {
        const table: any = {};

        if (syncDB.options.syncViews) {
          rtc.view.total += tblSchema[i].views.reduce(
            (acc, cur) =>
              ['grid', 'form', 'gallery'].includes(cur.type) ? ++acc : acc,
            0,
          );
        } else {
          rtc.view.total = tblSchema.length;
        }

        // Enable to use aTbl identifiers as is: table.id = tblSchema[i].id;
        table.title = tblSchema[i].name;
        let sanitizedName = sanitizeColumnName(tblSchema[i].name);

        // truncate to 50 chars if character if exceeds above 50
        // upto 64 should be fine but we are keeping it to 50 since
        // meta base adds prefix as well
        sanitizedName = sanitizedName?.slice(0, 50);

        // check for duplicate and populate a unique name if already exist
        table.table_name = uniqueTableNameGen(sanitizedName);

        const uniqueColNameGen = getUniqueNameGenerator('field');
        table.columns = [];
        const sysColumns = [
          {
            title: ncSysFields.id,
            column_name: ncSysFields.id,
            uidt: UITypes.ID,
            meta: {
              ag: 'nc',
            },
          },
          {
            title: ncSysFields.hash,
            column_name: ncSysFields.hash,
            uidt: UITypes.SingleLineText,
            system: true,
          },
        ];

        for (let j = 0; j < tblSchema[i].columns.length; j++) {
          const col = tblSchema[i].columns[j];

          // skip link, lookup, rollup fields in this iteration
          if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) {
            continue;
          }

          // base column schema
          const ncName: any = nc_getSanitizedColumnName(table, col.name);
          const ncCol: any = {
            // Enable to use aTbl identifiers as is: id: col.id,
            title: ncName.title,
            column_name: uniqueColNameGen(ncName.column_name),
            uidt: getNocoType(col),
          };

          // not supported datatype: pure formula field
          // allow formula based computed fields (created time/ modified time to go through)
          if (ncCol.uidt === UITypes.Formula) {
            updateMigrationSkipLog(
              tblSchema[i].name,
              ncName.title,
              col.type,
              'column type not supported',
            );
            continue;
          }

          // change from default 'tinytext' as airtable allows more than 255 characters
          // for single line text column type
          if (col.type === 'text') ncCol.dt = 'text';

          // #fix-2363-decimal-out-of-range
          if (['sqlite3', 'mysql2'].includes(getRootDbType())) {
            if (ncCol.uidt === UITypes.Decimal) {
              ncCol.dt = 'double';
              ncCol.dtxp = 22;
              ncCol.dtxs = '2';
            }
          }

          // additional column parameters when applicable
          const colOptions = await getNocoTypeOptions(col);

          switch (colOptions.type) {
            case 'select':
            case 'multiSelect':
              ncCol.colOptions = {
                options: [...colOptions.data],
              };

              if (['mysql', 'mysql2'].includes(getRootDbType())) {
                // if options are empty, configure '' as an option
                ncCol.dtxp =
                  colOptions.data
                    .map((el) => `'${el.title.replace(/'/gi, "''")}'`)
                    .join(',') || "''";
              }

              break;
            case undefined:
              break;
          }
          table.columns.push(ncCol);
        }
        table.columns.push(sysColumns[0]);
        table.columns.push(sysColumns[1]);

        tables.push(table);
      }
      return tables;
    };

    const nocoCreateBaseSchema = async (aTblSchema) => {
      // base schema preparation: exclude
      const tables: any[] = await tablesPrepare(aTblSchema);

      // for each table schema, create nc table
      for (let idx = 0; idx < tables.length; idx++) {
        logBasic(`:: [${idx + 1}/${tables.length}] ${tables[idx].title}`);

        logDetailed(`NC API: base.tableCreate ${tables[idx].title}`);

        let _perfStart = recordPerfStart();
        const table = await this.tablesService.tableCreate({
          sourceId: syncDB.sourceId,
          baseId: ncCreatedProjectSchema.id,
          table: tables[idx],
          user: syncDB.user,
        });
        recordPerfStats(_perfStart, 'dbTable.create');

        updateNcTblSchema(table);

        // update mapping table
        await sMap.addToMappingTbl(aTblSchema[idx].id, table.id, table.title);
        for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
          const aId = aTblSchema[idx].columns.find(
            (x) =>
              x.name.trim().replace(/\./g, '_') === table.columns[colIdx].title,
          )?.id;
          if (aId)
            await sMap.addToMappingTbl(
              aId,
              table.columns[colIdx].id,
              table.columns[colIdx].title,
              table.id,
            );
        }

        // update default view name- to match it to airtable view name
        logDetailed(`NC API: dbView.list ${table.id}`);
        _perfStart = recordPerfStart();
        const view = { list: [] };
        view['list'] = await this.viewsService.viewList({
          tableId: table.id,
          user: {
            roles: userRole,
            base_roles: {
              owner: true,
            },
          },
        });
        recordPerfStats(_perfStart, 'dbView.list');

        const aTbl_grid = aTblSchema[idx].views.find((x) => x.type === 'grid');
        logDetailed(
          `NC API: dbView.update ${view.list[0].id} ${aTbl_grid.name}`,
        );
        _perfStart = recordPerfStart();
        await this.viewsService.viewUpdate({
          viewId: view.list[0].id,
          view: { title: aTbl_grid.name },
          user: syncDB.user,
          req: {},
        });
        recordPerfStats(_perfStart, 'dbView.update');

        await updateNcTblSchemaById(table.id);

        await sMap.addToMappingTbl(
          aTbl_grid.id,
          table.views[0].id,
          aTbl_grid.name,
          table.id,
        );
      }

      return tables;
    };

    const nocoCreateLinkToAnotherRecord = async (aTblSchema) => {
      // Link to another RECORD
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const aTblLinkColumns = aTblSchema[idx].columns.filter(
          (x) => x.type === 'foreignKey',
        );

        // Link columns exist
        //
        if (aTblLinkColumns.length) {
          for (let i = 0; i < aTblLinkColumns.length; i++) {
            logDetailed(
              `[${idx + 1}/${aTblSchema.length}] Configuring Links :: [${
                i + 1
              }/${aTblLinkColumns.length}] ${aTblSchema[idx].name}`,
            );

            // for self links, there is no symmetric column
            {
              const src = aTbl_getColumnName(aTblLinkColumns[i].id);
              const dst = aTbl_getColumnName(
                aTblLinkColumns[i].typeOptions?.symmetricColumnId,
              );
              logDetailed(
                `LTAR ${src.tn}:${src.cn} <${aTblLinkColumns[i].typeOptions.relationship}> ${dst?.tn}:${dst?.cn}`,
              );
            }

            // check if link already established?
            if (!nc_isLinkExists(aTblLinkColumns[i].id)) {
              // parent table ID
              const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);

              // find child table name from symmetric column ID specified
              // self link, symmetricColumnId field will be undefined
              const childTable = aTbl_getColumnName(
                aTblLinkColumns[i].typeOptions?.symmetricColumnId,
              );

              // retrieve child table ID (nc) from table name
              let childTableId = srcTableId;
              if (childTable) {
                childTableId = (await nc_getTableSchema(childTable.tn)).id;
              }

              // check if already a column exists with this name?
              let _perfStart = recordPerfStart();
              const srcTbl: any =
                await this.tablesService.getTableWithAccessibleViews({
                  tableId: srcTableId,
                  user: { ...syncDB.user, base_roles: { owner: true } },
                });
              recordPerfStats(_perfStart, 'dbTable.read');

              // create link
              const ncName = nc_getSanitizedColumnName(
                srcTbl,
                aTblLinkColumns[i].name,
              );

              // LTAR alias ref to AT
              atNcAliasRef[srcTbl.id] = atNcAliasRef[srcTbl.id] || {};
              atNcAliasRef[srcTbl.id][ncName.title] = aTblLinkColumns[i].name;

              logDetailed(
                `NC API: dbTableColumn.create LinkToAnotherRecord ${ncName.title}`,
              );
              _perfStart = recordPerfStart();
              const ncTbl: any = await this.columnsService.columnAdd({
                tableId: srcTableId,
                column: {
                  uidt: UITypes.Links,
                  title: ncName.title,
                  column_name: ncName.column_name,
                  parentId: srcTableId,
                  childId: childTableId,
                  type: 'mm',
                },
                req: {
                  user: syncDB.user.email,
                  clientIp: '',
                },
                user: syncDB.user,
              });
              recordPerfStats(_perfStart, 'dbTableColumn.create');

              updateNcTblSchema(ncTbl);

              const ncId = ncTbl.columns.find(
                (x) => x.title === ncName.title,
              )?.id;
              await sMap.addToMappingTbl(
                aTblLinkColumns[i].id,
                ncId,
                ncName.title,
                ncTbl.id,
              );

              // store link information in separate table
              // this information will be helpful in identifying relation pair
              const link = {
                nc: {
                  title: ncName.title,
                  parentId: srcTableId,
                  childId: childTableId,
                  type: 'mm',
                },
                aTbl: {
                  tblId: aTblSchema[idx].id,
                  ...aTblLinkColumns[i],
                },
              };

              ncLinkMappingTable.push(link);
            } else {
              // if link already exists, we need to change name of linked column
              // to what is represented in airtable

              // 1. extract associated link information from link table
              // 2. retrieve parent table information (source)
              // 3. using foreign parent & child column ID, find associated mapping in child table
              // 4. update column name
              const x = ncLinkMappingTable.findIndex(
                (x) =>
                  x.aTbl.tblId ===
                    aTblLinkColumns[i].typeOptions.foreignTableId &&
                  x.aTbl.id ===
                    aTblLinkColumns[i].typeOptions.symmetricColumnId,
              );

              let _perfStart = recordPerfStart();
              const childTblSchema: any =
                await this.tablesService.getTableWithAccessibleViews({
                  tableId: ncLinkMappingTable[x].nc.childId,
                  user: { ...syncDB.user, base_roles: { owner: true } },
                });
              recordPerfStats(_perfStart, 'dbTable.read');

              _perfStart = recordPerfStart();
              const parentTblSchema: any =
                await this.tablesService.getTableWithAccessibleViews({
                  tableId: ncLinkMappingTable[x].nc.parentId,
                  user: { ...syncDB.user, base_roles: { owner: true } },
                });
              recordPerfStats(_perfStart, 'dbTable.read');

              let parentLinkColumn = parentTblSchema.columns.find(
                (col) => col.title === ncLinkMappingTable[x].nc.title,
              );

              if (parentLinkColumn === undefined) {
                updateMigrationSkipLog(
                  parentTblSchema?.title,
                  ncLinkMappingTable[x].nc.title,
                  UITypes.Links,
                  'Link error',
                );
                continue;
              }

              // hack // fix me
              if (!isLinksOrLTAR(parentLinkColumn)) {
                parentLinkColumn = parentTblSchema.columns.find(
                  (col) => col.title === ncLinkMappingTable[x].nc.title + '_2',
                );
              }

              let childLinkColumn: any = {};

              if (parentLinkColumn.colOptions.type == 'hm') {
                // for hm:
                // mapping between child & parent column id is direct
                //
                childLinkColumn = childTblSchema.columns.find(
                  (col) =>
                    isLinksOrLTAR(col) &&
                    col.colOptions.fk_child_column_id ===
                      parentLinkColumn.colOptions.fk_child_column_id &&
                    col.colOptions.fk_parent_column_id ===
                      parentLinkColumn.colOptions.fk_parent_column_id,
                );
              } else {
                // for mm:
                // mapping between child & parent column id is inverted
                //
                childLinkColumn = childTblSchema.columns.find(
                  (col) =>
                    isLinksOrLTAR(col) &&
                    col.colOptions.fk_child_column_id ===
                      parentLinkColumn.colOptions.fk_parent_column_id &&
                    col.colOptions.fk_parent_column_id ===
                      parentLinkColumn.colOptions.fk_child_column_id &&
                    col.colOptions.fk_mm_model_id ===
                      parentLinkColumn.colOptions.fk_mm_model_id,
                );
              }

              // check if already a column exists with this name?
              const duplicate = childTblSchema.columns.find(
                (x) => x.title === aTblLinkColumns[i].name,
              );
              const suffix = duplicate ? '_2' : '';
              if (duplicate)
                if (enableErrorLogs)
                  console.log(`## Duplicate ${aTblLinkColumns[i].name}`);

              // rename
              // note that: current rename API requires us to send all parameters,
              // not just title being renamed
              const ncName = nc_getSanitizedColumnName(
                childTblSchema,
                aTblLinkColumns[i].name,
              );

              logDetailed(
                `NC API: dbTableColumn.update rename symmetric column ${ncName.title}`,
              );
              _perfStart = recordPerfStart();
              const ncTbl: any = await this.columnsService.columnUpdate({
                columnId: childLinkColumn.id,
                column: {
                  ...childLinkColumn,
                  title: ncName.title,
                  column_name: ncName.column_name,
                },
                user: syncDB.user,
              });
              recordPerfStats(_perfStart, 'dbTableColumn.update');

              updateNcTblSchema(ncTbl);

              const ncId = ncTbl.columns.find(
                (x) => x.title === aTblLinkColumns[i].name + suffix,
              )?.id;
              await sMap.addToMappingTbl(
                aTblLinkColumns[i].id,
                ncId,
                aTblLinkColumns[i].name + suffix,
                ncTbl.id,
              );
            }
          }
        }
      }
    };

    const nocoCreateLookups = async (aTblSchema) => {
      // LookUps
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const aTblColumns = aTblSchema[idx].columns.filter(
          (x) => x.type === 'lookup',
        );

        // parent table ID
        const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
        const srcTableSchema = ncSchema.tablesById[srcTableId];

        if (aTblColumns.length) {
          // Lookup
          for (let i = 0; i < aTblColumns.length; i++) {
            logDetailed(
              `[${idx + 1}/${aTblSchema.length}] Configuring Lookup :: [${
                i + 1
              }/${aTblColumns.length}] ${aTblSchema[idx].name}`,
            );

            // something is not right, skip
            if (
              aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds
                ?.length
            ) {
              if (enableErrorLogs)
                console.log(`## Invalid column IDs mapped; skip`);

              updateMigrationSkipLog(
                srcTableSchema.title,
                aTblColumns[i].name,
                aTblColumns[i].type,
                'invalid column ID in dependency list',
              );
              continue;
            }

            const ncRelationColumnId = await sMap.getNcIdFromAtId(
              aTblColumns[i].typeOptions.relationColumnId,
            );
            const ncLookupColumnId = await sMap.getNcIdFromAtId(
              aTblColumns[i].typeOptions.foreignTableRollupColumnId,
            );

            if (
              ncLookupColumnId === undefined ||
              ncRelationColumnId === undefined
            ) {
              aTblColumns[i]['srcTableId'] = srcTableId;
              nestedLookupTbl.push(aTblColumns[i]);
              continue;
            }

            const ncName = nc_getSanitizedColumnName(
              srcTableSchema,
              aTblColumns[i].name,
            );

            logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
            const _perfStart = recordPerfStart();
            const ncTbl: any = await this.columnsService.columnAdd({
              tableId: srcTableId,
              column: {
                uidt: UITypes.Lookup,
                title: ncName.title,
                column_name: ncName.column_name,
                fk_relation_column_id: ncRelationColumnId,
                fk_lookup_column_id: ncLookupColumnId,
              },
              req: {
                user: syncDB.user.email,
                clientIp: '',
              },
              user: syncDB.user,
            });
            recordPerfStats(_perfStart, 'dbTableColumn.create');

            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(
              (x) => x.title === aTblColumns[i].name,
            )?.id;
            await sMap.addToMappingTbl(
              aTblColumns[i].id,
              ncId,
              aTblColumns[i].name,
              ncTbl.id,
            );
          }
        }
      }

      let level = 2;
      let nestedCnt = 0;
      while (nestedLookupTbl.length) {
        // if nothing has changed from previous iteration, skip rest
        if (nestedCnt === nestedLookupTbl.length) {
          for (let i = 0; i < nestedLookupTbl.length; i++) {
            const fTblField =
              nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId;
            const name = aTbl_getColumnName(fTblField);
            updateMigrationSkipLog(
              ncSchema.tablesById[nestedLookupTbl[i].srcTableId]?.title,
              nestedLookupTbl[i].name,
              nestedLookupTbl[i].type,
              `foreign table field not found [${name.tn}/${name.cn}]`,
            );
          }
          if (enableErrorLogs)
            console.log(
              `## Failed to configure ${nestedLookupTbl.length} lookups`,
            );
          break;
        }

        // Nested lookup
        nestedCnt = nestedLookupTbl.length;
        for (let i = 0; i < nestedLookupTbl.length; i++) {
          const srcTableId = nestedLookupTbl[0].srcTableId;
          const srcTableSchema = ncSchema.tablesById[srcTableId];

          const ncRelationColumnId = await sMap.getNcIdFromAtId(
            nestedLookupTbl[0].typeOptions.relationColumnId,
          );
          const ncLookupColumnId = await sMap.getNcIdFromAtId(
            nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId,
          );

          if (
            ncLookupColumnId === undefined ||
            ncRelationColumnId === undefined
          ) {
            continue;
          }

          const ncName = nc_getSanitizedColumnName(
            srcTableSchema,
            nestedLookupTbl[0].name,
          );

          logDetailed(
            `Configuring Nested Lookup: Level-${level} [${i + 1}/${nestedCnt} ${
              ncName.title
            }]`,
          );

          logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
          const _perfStart = recordPerfStart();
          const ncTbl: any = await this.columnsService.columnAdd({
            tableId: srcTableId,
            column: {
              uidt: UITypes.Lookup,
              title: ncName.title,
              column_name: ncName.column_name,
              fk_relation_column_id: ncRelationColumnId,
              fk_lookup_column_id: ncLookupColumnId,
            },
            req: {
              user: syncDB.user.email,
              clientIp: '',
            },
            user: syncDB.user,
          });
          recordPerfStats(_perfStart, 'dbTableColumn.create');

          updateNcTblSchema(ncTbl);

          const ncId = ncTbl.columns.find(
            (x) => x.title === nestedLookupTbl[0].name,
          )?.id;
          await sMap.addToMappingTbl(
            nestedLookupTbl[0].id,
            ncId,
            nestedLookupTbl[0].name,
            ncTbl.id,
          );

          // remove entry
          nestedLookupTbl.splice(0, 1);
        }
        level++;
      }
    };

    const getRollupNcFunction = (aTblFunction) => {
      const fn = aTblFunction.split('(')[0];
      const aTbl_ncRollUp = {
        AND: '',
        ARRAYCOMPACT: '',
        ARRAYJOIN: '',
        ARRAYUNIQUE: '',
        AVERAGE: 'average',
        CONCATENATE: '',
        COUNT: 'count',
        COUNTA: '',
        COUNTALL: '',
        MAX: 'max',
        MIN: 'min',
        OR: '',
        SUM: 'sum',
        XOR: '',
      };
      return aTbl_ncRollUp[fn];
    };

    const nocoCreateRollup = async (aTblSchema) => {
      // Rollup
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const aTblColumns = aTblSchema[idx].columns.filter(
          (x) => x.type === 'rollup',
        );

        // parent table ID
        const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
        const srcTableSchema = ncSchema.tablesById[srcTableId];

        if (aTblColumns.length) {
          // rollup exist
          for (let i = 0; i < aTblColumns.length; i++) {
            logDetailed(
              `[${idx + 1}/${aTblSchema.length}] Configuring Rollup :: [${
                i + 1
              }/${aTblColumns.length}] ${aTblSchema[idx].name}`,
            );

            // fetch associated rollup function
            // skip column creation if supported rollup function does not exist
            const ncRollupFn = getRollupNcFunction(
              aTblColumns[i].typeOptions.formulaTextParsed,
            );

            if (ncRollupFn === '' || ncRollupFn === undefined) {
              updateMigrationSkipLog(
                srcTableSchema.title,
                aTblColumns[i].name,
                aTblColumns[i].type,
                `rollup function ${aTblColumns[i].typeOptions.formulaTextParsed} not supported`,
              );
              continue;
            }

            // something is not right, skip
            if (
              aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds
                ?.length
            ) {
              if (enableErrorLogs)
                console.log(`## Invalid column IDs mapped; skip`);

              updateMigrationSkipLog(
                srcTableSchema.title,
                aTblColumns[i].name,
                aTblColumns[i].type,
                'invalid column ID in dependency list',
              );
              continue;
            }

            const ncRelationColumnId = await sMap.getNcIdFromAtId(
              aTblColumns[i].typeOptions.relationColumnId,
            );
            const ncRollupColumnId = await sMap.getNcIdFromAtId(
              aTblColumns[i].typeOptions.foreignTableRollupColumnId,
            );

            if (ncRollupColumnId === undefined) {
              aTblColumns[i]['srcTableId'] = srcTableId;
              nestedRollupTbl.push(aTblColumns[i]);
              continue;
            }

            // skip, if rollup column was pointing to another virtual column
            const ncColSchema = await nc_getColumnSchema(
              aTblColumns[i].typeOptions.foreignTableRollupColumnId,
            );
            if (
              ncColSchema?.uidt === UITypes.Formula ||
              ncColSchema?.uidt === UITypes.Lookup ||
              ncColSchema?.uidt === UITypes.Rollup ||
              ncColSchema?.uidt === UITypes.Checkbox
            ) {
              updateMigrationSkipLog(
                srcTableSchema.title,
                aTblColumns[i].name,
                aTblColumns[i].type,
                'rollup referring to a column type not supported currently',
              );
              continue;
            }

            const ncName = nc_getSanitizedColumnName(
              srcTableSchema,
              aTblColumns[i].name,
            );

            logDetailed(`NC API: dbTableColumn.create ROLLUP ${ncName.title}`);
            const _perfStart = recordPerfStart();
            const ncTbl: any = await this.columnsService.columnAdd({
              tableId: srcTableId,
              column: {
                uidt: UITypes.Rollup,
                title: ncName.title,
                column_name: ncName.column_name,
                fk_relation_column_id: ncRelationColumnId,
                fk_rollup_column_id: ncRollupColumnId,
                rollup_function: ncRollupFn,
              },
              req: {
                user: syncDB.user.email,
                clientIp: '',
              },
              user: syncDB.user,
            });
            recordPerfStats(_perfStart, 'dbTableColumn.create');

            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(
              (x) => x.title === aTblColumns[i].name,
            )?.id;
            await sMap.addToMappingTbl(
              aTblColumns[i].id,
              ncId,
              aTblColumns[i].name,
              ncTbl.id,
            );
          }
        }
      }
      logDetailed(`Nested rollup: ${nestedRollupTbl.length}`);
    };

    const nocoLookupForRollup = async () => {
      const nestedCnt = nestedLookupTbl.length;
      for (let i = 0; i < nestedLookupTbl.length; i++) {
        const srcTableId = nestedLookupTbl[0].srcTableId;
        const srcTableSchema = ncSchema.tablesById[srcTableId];

        const ncRelationColumnId = await sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.relationColumnId,
        );
        const ncLookupColumnId = await sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId,
        );

        if (
          ncLookupColumnId === undefined ||
          ncRelationColumnId === undefined
        ) {
          continue;
        }

        const ncName = nc_getSanitizedColumnName(
          srcTableSchema,
          nestedLookupTbl[0].name,
        );

        logDetailed(
          `Configuring Lookup over Rollup :: [${i + 1}/${nestedCnt}] ${
            ncName.title
          }`,
        );

        logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
        const _perfStart = recordPerfStart();
        const ncTbl: any = await this.columnsService.columnAdd({
          tableId: srcTableId,
          column: {
            uidt: UITypes.Lookup,
            title: ncName.title,
            column_name: ncName.column_name,
            fk_relation_column_id: ncRelationColumnId,
            fk_lookup_column_id: ncLookupColumnId,
          },
          req: {
            user: syncDB.user.email,
            clientIp: '',
          },
          user: syncDB.user,
        });
        recordPerfStats(_perfStart, 'dbTableColumn.create');

        updateNcTblSchema(ncTbl);

        const ncId = ncTbl.columns.find(
          (x) => x.title === nestedLookupTbl[0].name,
        )?.id;
        await sMap.addToMappingTbl(
          nestedLookupTbl[0].id,
          ncId,
          nestedLookupTbl[0].name,
          ncTbl.id,
        );

        // remove entry
        nestedLookupTbl.splice(0, 1);
      }
    };

    const nocoSetPrimary = async (aTblSchema) => {
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        logDetailed(
          `[${idx + 1}/${aTblSchema.length}] Configuring Display value : ${
            aTblSchema[idx].name
          }`,
        );

        const pColId = aTblSchema[idx].primaryColumnId;
        const ncColId = await sMap.getNcIdFromAtId(pColId);

        // skip primary column configuration if we field not migrated
        if (ncColId) {
          logDetailed(`NC API: dbTableColumn.primaryColumnSet`);
          const _perfStart = recordPerfStart();
          await this.columnsService.columnSetAsPrimary({ columnId: ncColId });
          recordPerfStats(_perfStart, 'dbTableColumn.primaryColumnSet');

          // update schema
          const ncTblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
          await updateNcTblSchemaById(ncTblId);
        }
      }
    };

    // retrieve nc-view column ID from corresponding nc-column ID
    const nc_getViewColumnId = async (viewId, viewType, ncColumnId) => {
      // retrieve view Info
      let viewDetails;

      const _perfStart = recordPerfStart();
      if (viewType === 'form') {
        viewDetails = (
          await this.formsService.formViewGet({ formViewId: viewId })
        ).columns;
        recordPerfStats(_perfStart, 'dbView.formRead');
      } else if (viewType === 'gallery') {
        viewDetails = (
          await this.galleriesService.galleryViewGet({ galleryViewId: viewId })
        ).columns;
        recordPerfStats(_perfStart, 'dbView.galleryRead');
      } else {
        viewDetails = await this.viewColumnsService.columnList({
          viewId: viewId,
        });
        recordPerfStats(_perfStart, 'dbView.gridColumnsList');
      }

      return viewDetails.find((x) => x.fk_column_id === ncColumnId)?.id;
    };

    //////////  Data processing

    const nocoBaseDataProcessing_v2 = async (sDB, table, record) => {
      const recordHash = hash(record);
      const rec = { ...record.fields };

      // kludge -
      // trim spaces on either side of column name
      // leads to error in NocoDB
      Object.keys(rec).forEach((key) => {
        const replacedKey = key.trim().replace(/\./g, '_');
        if (key !== replacedKey) {
          rec[replacedKey] = rec[key];
          delete rec[key];
        }
      });

      // post-processing on the record
      for (const [key, value] of Object.entries(
        rec as { [key: string]: any },
      )) {
        // retrieve datatype
        const dt = table.columns.find((x) => x.title === key)?.uidt;

        // always process LTAR, Lookup, and Rollup columns as we delete the key after processing
        if (
          !value &&
          !isLinksOrLTAR(dt) &&
          dt !== UITypes.Lookup &&
          dt !== UITypes.Rollup
        ) {
          rec[key] = null;
          continue;
        }

        switch (dt) {
          // https://www.npmjs.com/package/validator
          // default value: digits_after_decimal: [2]
          // if currency, set decimal place to 2
          //
          case UITypes.Currency:
            rec[key] = (+value).toFixed(2);
            break;

          // we will pick up LTAR once all table data's are in place
          case UITypes.LinkToAnotherRecord:
          case UITypes.Links:
            if (storeLinks) {
              if (ncLinkDataStore[table.title][record.id] === undefined)
                ncLinkDataStore[table.title][record.id] = {
                  id: record.id,
                  fields: {},
                };
              ncLinkDataStore[table.title][record.id]['fields'][key] = value;
            }
            delete rec[key];
            break;

          // these will be automatically populated depending on schema configuration
          case UITypes.Lookup:
          case UITypes.Rollup:
            delete rec[key];
            break;

          case UITypes.Collaborator:
            // in case of multi-collaborator, this will be an array
            if (Array.isArray(value)) {
              let collaborators = '';
              for (let i = 0; i < value.length; i++) {
                collaborators += `${value[i]?.name} <${value[i]?.email}>, `;
                rec[key] = collaborators;
              }
            } else rec[key] = `${value?.name} <${value?.email}>`;
            break;

          case UITypes.Button:
            rec[key] = `${value?.label} <${value?.url}>`;
            break;

          case UITypes.DateTime:
          case UITypes.CreateTime:
          case UITypes.LastModifiedTime:
            rec[key] = dayjs(value).format('YYYY-MM-DD HH:mm');
            break;

          case UITypes.Date:
            if (/\d{5,}/.test(value)) {
              // skip
              rec[key] = null;
              logBasic(`:: Invalid date ${value}`);
            } else {
              rec[key] = dayjs(value).format('YYYY-MM-DD');
            }
            break;

          case UITypes.SingleSelect:
            if (value === '') {
              rec[key] = 'nc_empty';
            }
            rec[key] = value;
            break;

          case UITypes.MultiSelect:
            rec[key] = value
              ?.map((v) => {
                if (v === '') {
                  return 'nc_empty';
                }
                return `${v.replace(/,/g, '.')}`;
              })
              .join(',');
            break;

          case UITypes.Attachment:
            if (!syncDB.options.syncAttachment) rec[key] = null;
            else {
              let tempArr = [];

              try {
                logBasic(
                  ` :: Retrieving attachment :: ${value
                    ?.map((a) => a.filename?.split('?')?.[0])
                    .join(', ')}`,
                );
                const path = `${moment().format('YYYY/MM/DD')}/${hash(
                  syncDB.user.id,
                )}`;
                tempArr = await this.attachmentsService.uploadViaURL({
                  path,
                  urls: value?.map((attachment) => ({
                    fileName: attachment.filename?.split('?')?.[0],
                    url: attachment.url,
                    size: attachment.size,
                    mimetype: attachment.type,
                  })),
                  req: {},
                });
              } catch (e) {
                console.log(e);
              }

              rec[key] = JSON.stringify(tempArr);
            }
            break;

          case UITypes.SingleLineText:
            // Barcode data
            if (value?.text) {
              rec[key] = value.text;
            }
            break;

          default:
            break;
        }
      }

      // insert airtable record ID explicitly into each records
      rec[ncSysFields.id] = record.id;
      rec[ncSysFields.hash] = recordHash;

      return rec;
    };

    const nc_isLinkExists = (airtableFieldId) => {
      return !!ncLinkMappingTable.find(
        (x) => x.aTbl.typeOptions.symmetricColumnId === airtableFieldId,
      );
    };

    const nocoCreateProject = async (projName) => {
      // create empty base (XC-DB)
      logDetailed(`Create Base: ${projName}`);
      const _perfStart = recordPerfStart();

      ncCreatedProjectSchema = await this.basesService.baseCreate({
        base: { title: projName },
        user: { id: syncDB.user.id },
        req: {},
      });

      recordPerfStats(_perfStart, 'base.create');
    };

    const nocoGetProject = async (projId) => {
      // create empty base (XC-DB)
      logDetailed(`Getting base meta: ${projId}`);
      const _perfStart = recordPerfStart();
      ncCreatedProjectSchema = await this.basesService.getProjectWithInfo({
        baseId: projId,
      });
      recordPerfStats(_perfStart, 'base.read');
    };

    const nocoConfigureGalleryView = async (sDB, aTblSchema) => {
      if (!sDB.options.syncViews) return;
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const tblId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
        const galleryViews = aTblSchema[idx].views.filter(
          (x) => x.type === 'gallery',
        );

        const configuredViews =
          rtc.view.grid + rtc.view.gallery + rtc.view.form;
        rtc.view.gallery += galleryViews.length;

        for (let i = 0; i < galleryViews.length; i++) {
          logDetailed(`   Axios fetch view-data`);

          // create view
          await getViewData(galleryViews[i].id);
          const viewName = aTblSchema[idx].views.find(
            (x) => x.id === galleryViews[i].id,
          )?.name;

          logBasic(
            `:: [${configuredViews + i + 1}/${rtc.view.total}] Gallery : ${
              aTblSchema[idx].name
            } / ${viewName}`,
          );

          logDetailed(`NC API dbView.galleryCreate :: ${viewName}`);
          const _perfStart = recordPerfStart();
          await this.galleriesService.galleryViewCreate({
            tableId: tblId,
            gallery: {
              title: viewName,
            },
            user: syncDB.user,
            req: {},
          });
          recordPerfStats(_perfStart, 'dbView.galleryCreate');

          await updateNcTblSchemaById(tblId);
        }
      }
    };

    const nocoConfigureFormView = async (sDB, aTblSchema) => {
      if (!sDB.options.syncViews) return;
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const tblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
        const formViews = aTblSchema[idx].views.filter(
          (x) => x.type === 'form',
        );

        const configuredViews =
          rtc.view.grid + rtc.view.gallery + rtc.view.form;
        rtc.view.form += formViews.length;
        for (let i = 0; i < formViews.length; i++) {
          logDetailed(`   Axios fetch view-data`);

          // create view
          const vData = await getViewData(formViews[i].id);
          const viewName = aTblSchema[idx].views.find(
            (x) => x.id === formViews[i].id,
          )?.name;

          logBasic(
            `:: [${configuredViews + i + 1}/${rtc.view.total}] Form : ${
              aTblSchema[idx].name
            } / ${viewName}`,
          );

          // everything is default
          let refreshMode = 'NO_REFRESH';
          let msg = 'Thank you for submitting the form!';
          let desc = '';

          // response will not include form object if everything is default
          //
          if (vData.metadata?.form) {
            if (vData.metadata.form?.refreshAfterSubmit)
              refreshMode = vData.metadata.form.refreshAfterSubmit;
            if (vData.metadata.form?.afterSubmitMessage)
              msg = vData.metadata.form.afterSubmitMessage;
            if (vData.metadata.form?.description)
              desc = vData.metadata.form.description;
          }

          const formData = {
            title: viewName,
            heading: viewName,
            subheading: desc,
            success_msg: msg,
            submit_another_form: refreshMode.includes('REFRESH_BUTTON'),
            show_blank_form: refreshMode.includes('AUTO_REFRESH'),
          };

          logDetailed(`NC API dbView.formCreate :: ${viewName}`);
          const _perfStart = recordPerfStart();
          // const f = await api.dbView.formCreate(tblId, formData);
          const f = await this.formsService.formViewCreate({
            tableId: tblId,
            body: formData,
            user: syncDB.user,
            req: {},
          });
          recordPerfStats(_perfStart, 'dbView.formCreate');

          logDetailed(
            `[${idx + 1}/${aTblSchema.length}][Form View][${i + 1}/${
              formViews.length
            }] Create ${viewName}`,
          );

          await updateNcTblSchemaById(tblId);

          logDetailed(`   Configure show/hide columns`);
          await nc_configureFields(
            f.id,
            vData,
            aTblSchema[idx].name,
            viewName,
            'form',
          );
        }
      }
    };

    const nocoConfigureGridView = async (sDB, aTblSchema) => {
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        const tblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
        const gridViews = aTblSchema[idx].views.filter(
          (x) => x.type === 'grid',
        );

        let viewCnt = idx;
        if (syncDB.options.syncViews)
          viewCnt = rtc.view.grid + rtc.view.gallery + rtc.view.form;
        rtc.view.grid += gridViews.length;

        for (
          let i = 0;
          i < (sDB.options.syncViews ? gridViews.length : 1);
          i++
        ) {
          logDetailed(`   Axios fetch view-data`);
          // fetch viewData JSON
          const vData = await getViewData(gridViews[i].id);

          // retrieve view name & associated NC-ID
          const viewName = aTblSchema[idx].views.find(
            (x) => x.id === gridViews[i].id,
          )?.name;
          const _perfStart = recordPerfStart();
          // const viewList: any = await api.dbView.list(tblId);
          const viewList = { list: [] };
          viewList['list'] = await this.viewsService.viewList({
            tableId: tblId,
            user: {
              roles: userRole,
              base_roles: {
                owner: true,
              },
            } as any,
          });
          recordPerfStats(_perfStart, 'dbView.list');

          let ncViewId = viewList?.list?.find((x) => x.tn === viewName)?.id;

          logBasic(
            `:: [${viewCnt + i + 1}/${rtc.view.total}] Grid : ${
              aTblSchema[idx].name
            } / ${viewName}`,
          );

          // create view (default already created)
          if (i > 0) {
            logDetailed(`NC API dbView.gridCreate :: ${viewName}`);
            const _perfStart = recordPerfStart();
            const viewCreated = await this.gridsService.gridViewCreate({
              tableId: tblId,
              grid: {
                title: viewName,
              },
              req: {},
            });
            recordPerfStats(_perfStart, 'dbView.gridCreate');

            await updateNcTblSchemaById(tblId);
            await sMap.addToMappingTbl(
              gridViews[i].id,
              viewCreated.id,
              viewName,
              tblId,
            );
            ncViewId = viewCreated.id;
          }

          logDetailed(`   Configure show/hide columns`);
          await nc_configureFields(
            ncViewId,
            vData,
            aTblSchema[idx].name,
            viewName,
            'grid',
          );

          // configure filters
          if (vData?.filters) {
            logDetailed(`   Configure filter set`);

            // skip filters if nested
            if (!vData.filters.filterSet.find((x) => x?.type === 'nested')) {
              await nc_configureFilters(ncViewId, vData.filters);
            }
          }

          // configure sort
          if (vData?.lastSortsApplied?.sortSet.length) {
            logDetailed(`   Configure sort set`);
            await nc_configureSort(ncViewId, vData.lastSortsApplied);
          }

          // configure group
          if (vData?.groupLevels) {
            logDetailed(`   Configure group set`);
            await nc_configureGroup(ncViewId, vData.groupLevels);
          }
        }
      }
    };

    const nocoAddUsers = async (aTblSchema) => {
      const userRoles = {
        owner: 'owner',
        create: 'creator',
        edit: 'editor',
        comment: 'commenter',
        read: 'viewer',
        none: 'viewer',
      };
      const userList = aTblSchema.appBlanket.userInfoById;
      const totalUsers = Object.keys(userList).length;
      let cnt = 0;
      const insertJobs: Promise<any>[] = [];

      for (const [, value] of Object.entries(
        userList as { [key: string]: any },
      )) {
        logDetailed(
          `[${++cnt}/${totalUsers}] NC API auth.baseUserAdd :: ${value.email}`,
        );
        const _perfStart = recordPerfStart();
        insertJobs.push(
          this.baseUsersService
            .userInvite({
              baseId: ncCreatedProjectSchema.id,
              baseUser: {
                email: value.email,
                roles: userRoles[value.permissionLevel],
              },
              req: { user: syncDB.user, clientIp: '' },
            })
            .catch((e) =>
              e.message ? logBasic(`NOTICE: ${e.message}`) : console.log(e),
            ),
        );
        recordPerfStats(_perfStart, 'auth.baseUserAdd');
      }
      await Promise.all(insertJobs);
    };

    const updateNcTblSchema = (tblSchema) => {
      const tblId = tblSchema.id;

      // replace entry from array if already exists
      const idx = ncSchema.tables.findIndex((x) => x.id === tblId);
      if (idx !== -1) ncSchema.tables.splice(idx, 1);
      ncSchema.tables.push(tblSchema);

      // overwrite object if it exists
      ncSchema.tablesById[tblId] = tblSchema;
    };

    const updateNcTblSchemaById = async (tblId) => {
      const _perfStart = recordPerfStart();
      const ncTbl: any = await this.tablesService.getTableWithAccessibleViews({
        tableId: tblId,
        user: { ...syncDB.user, base_roles: { owner: true } },
      });
      recordPerfStats(_perfStart, 'dbTable.read');

      updateNcTblSchema(ncTbl);
    };

    ///////////////////////

    // statistics
    //
    const migrationStats = [];

    const generateMigrationStats = async (aTblSchema) => {
      const migrationStatsObj = {
        table_name: '',
        aTbl: {
          columns: 0,
          links: 0,
          lookup: 0,
          rollup: 0,
        },
        nc: {
          columns: 0,
          links: 0,
          lookup: 0,
          rollup: 0,
          invalidColumn: 0,
        },
      };
      for (let idx = 0; idx < aTblSchema.length; idx++) {
        migrationStatsObj.table_name = aTblSchema[idx].name;

        const aTblLinkColumns = aTblSchema[idx].columns.filter(
          (x) => x.type === 'foreignKey',
        );
        const aTblLookup = aTblSchema[idx].columns.filter(
          (x) => x.type === 'lookup',
        );
        const aTblRollup = aTblSchema[idx].columns.filter(
          (x) => x.type === 'rollup',
        );

        let invalidColumnId = 0;
        for (let i = 0; i < aTblLookup.length; i++) {
          if (
            aTblLookup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            invalidColumnId++;
          }
        }
        for (let i = 0; i < aTblRollup.length; i++) {
          if (
            aTblRollup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            invalidColumnId++;
          }
        }

        migrationStatsObj.aTbl.columns = aTblSchema[idx].columns.length;
        migrationStatsObj.aTbl.links = aTblLinkColumns.length;
        migrationStatsObj.aTbl.lookup = aTblLookup.length;
        migrationStatsObj.aTbl.rollup = aTblRollup.length;

        const ncTbl = await nc_getTableSchema(aTblSchema[idx].name);
        const linkColumn = ncTbl.columns.filter((x) => isLinksOrLTAR(x));
        const lookup = ncTbl.columns.filter((x) => x.uidt === UITypes.Lookup);
        const rollup = ncTbl.columns.filter((x) => x.uidt === UITypes.Rollup);

        // all links hardwired as m2m. m2m generates additional tables per link
        // hence link/2
        migrationStatsObj.nc.columns =
          ncTbl.columns.length - linkColumn.length / 2;
        migrationStatsObj.nc.links = linkColumn.length / 2;
        migrationStatsObj.nc.lookup = lookup.length;
        migrationStatsObj.nc.rollup = rollup.length;
        migrationStatsObj.nc.invalidColumn = invalidColumnId;

        const temp = JSON.parse(JSON.stringify(migrationStatsObj));
        migrationStats.push(temp);
      }

      const columnSum = migrationStats.reduce((accumulator, object) => {
        return accumulator + object.nc.columns;
      }, 0);
      const linkSum = migrationStats.reduce((accumulator, object) => {
        return accumulator + object.nc.links;
      }, 0);
      const lookupSum = migrationStats.reduce((accumulator, object) => {
        return accumulator + object.nc.lookup;
      }, 0);
      const rollupSum = migrationStats.reduce((accumulator, object) => {
        return accumulator + object.nc.rollup;
      }, 0);

      logBasic(`Quick Summary:`);
      logBasic(`:: Total Tables:   ${aTblSchema.length}`);
      logBasic(`:: Total Columns:  ${columnSum}`);
      logBasic(`::   Links:        ${linkSum}`);
      logBasic(`::   Lookup:       ${lookupSum}`);
      logBasic(`::   Rollup:       ${rollupSum}`);
      logBasic(`:: Total Filters:  ${rtc.filter}`);
      logBasic(`:: Total Sort:     ${rtc.sort}`);
      logBasic(`:: Total Views:    ${rtc.view.total}`);
      logBasic(`::   Grid:         ${rtc.view.grid}`);
      logBasic(`::   Gallery:      ${rtc.view.gallery}`);
      logBasic(`::   Form:         ${rtc.view.form}`);
      logBasic(`:: Total Records:  ${rtc.data.records}`);
      logBasic(`:: Total Nested Links: ${rtc.data.nestedLinks}`);

      const duration = Date.now() - start;
      logBasic(`:: Migration time:      ${duration}`);
      logBasic(`:: Axios fetch count:   ${rtc.fetchAt.count}`);
      logBasic(`:: Axios fetch time:    ${rtc.fetchAt.time}`);

      this.telemetryService.sendEvent({
        evt_type: 'a:airtable-import:success',
        user_id: syncDB.user.id,
        email: syncDB.user.email,
        data: {
          stats: {
            migrationTime: duration,
            totalTables: aTblSchema.length,
            totalColumns: columnSum,
            links: linkSum,
            lookup: lookupSum,
            rollup: rollupSum,
            totalFilters: rtc.filter,
            totalSort: rtc.sort,
            view: {
              total: rtc.view.total,
              grid: rtc.view.grid,
              gallery: rtc.view.gallery,
              form: rtc.view.form,
            },
            axios: {
              count: rtc.fetchAt.count,
              time: rtc.fetchAt.time,
            },
            totalRecords: rtc.data.records,
            nestedLinks: rtc.data.nestedLinks,
          },
        },
      });
    };

    //////////////////////////////
    // filters

    const filterMap = {
      '=': 'eq',
      '!=': 'neq',
      '<': 'lt',
      '<=': 'lte',
      '>': 'gt',
      '>=': 'gte',
      isEmpty: 'blank',
      isNotEmpty: 'notblank',
      contains: 'like',
      doesNotContain: 'nlike',
      isAnyOf: 'anyof',
      isNoneOf: 'nanyof',
      '|': 'anyof',
      '&': 'allof',
    };

    const nc_configureFilters = async (viewId, f) => {
      for (let i = 0; i < f.filterSet.length; i++) {
        const filter = f.filterSet[i];
        const colSchema = await nc_getColumnSchema(filter.columnId);

        // column not available;
        // one of not migrated column;
        if (!colSchema) {
          updateMigrationSkipLog(
            await sMap.getNcNameFromAtId(viewId),
            colSchema.title,
            colSchema.uidt,
            `filter config skipped; column not migrated`,
          );
          continue;
        }
        const columnId = colSchema.id;
        const datatype = colSchema.uidt;
        const ncFilters = [];

        // console.log(filter)
        if (datatype === UITypes.Links) {
          // skip filters for links; Link filters in NocoDB are only rollup counts
          // where-as in airtable, filter can be textual
          updateMigrationSkipLog(
            await sMap.getNcNameFromAtId(viewId),
            colSchema.title,
            colSchema.uidt,
            `filter config skipped; filter over date datatype not supported`,
          );
          continue;
        }

        // single-select & multi-select
        else if (
          datatype === UITypes.SingleSelect ||
          datatype === UITypes.MultiSelect
        ) {
          if (filter.operator === 'doesNotContain') {
            filter.operator = 'isNoneOf';
          }
          // if array, break it down to multiple filters
          if (Array.isArray(filter.value)) {
            const fx = {
              fk_column_id: columnId,
              logical_op: f.conjunction,
              comparison_op: filterMap[filter.operator],
              value: (
                await Promise.all(
                  filter.value.map(
                    async (f) => await sMap.getNcNameFromAtId(f),
                  ),
                )
              ).join(','),
            };
            ncFilters.push(fx);
          }
          // not array - add as is
          else if (filter.value) {
            const fx = {
              fk_column_id: columnId,
              logical_op: f.conjunction,
              comparison_op: filterMap[filter.operator],
              value: await sMap.getNcNameFromAtId(filter.value),
            };
            ncFilters.push(fx);
          }
        } else if (datatype === UITypes.Date || datatype === UITypes.DateTime) {
          if (filter.operator === 'isWithin') {
            const fx = {
              fk_column_id: columnId,
              logical_op: f.conjunction,
              comparison_op: filter.operator,
              comparison_sub_op: filter.value?.mode,
              value: filter.value?.numberOfDays,
            };
            ncFilters.push(fx);
          } else {
            const fx = {
              fk_column_id: columnId,
              logical_op: f.conjunction,
              comparison_op: filterMap[filter.operator],
              comparison_sub_op: filter.value?.mode,
              value: filter.value?.exactDate,
            };
            ncFilters.push(fx);
          }
        }

        // other data types (number/ text/ long text/ ..)
        else if (filter.value) {
          const fx = {
            fk_column_id: columnId,
            logical_op: f.conjunction,
            comparison_op: filterMap[filter.operator],
            value: filter.value,
          };
          ncFilters.push(fx);
        }

        // insert filters
        for (let i = 0; i < ncFilters.length; i++) {
          const _perfStart = recordPerfStart();
          await this.filtersService.filterCreate({
            viewId: viewId,
            filter: ncFilters[i],
            user: syncDB.user,
            req: {},
          });
          recordPerfStats(_perfStart, 'dbTableFilter.create');

          rtc.filter++;
        }
      }
    };

    //////////////////////////////
    // group

    const nc_configureGroup = async (viewId, g) => {
      const ncGroup = [];

      for (let i = 0; i < g.length; i++) {
        const group = g[i];
        const colSchema = await nc_getColumnSchema(group.columnId);

        // column not available;
        // one of not migrated column;
        if (!colSchema) {
          updateMigrationSkipLog(
            await sMap.getNcNameFromAtId(viewId),
            colSchema.title,
            colSchema.uidt,
            `group config skipped; column not migrated`,
          );
          continue;
        }

        const columnId = colSchema.id;
        const datatype = colSchema.uidt;

        if (
          datatype === UITypes.Date ||
          datatype === UITypes.DateTime ||
          datatype === UITypes.Links ||
          datatype === UITypes.MultiSelect ||
          datatype === UITypes.SingleSelect ||
          datatype === UITypes.SingleLineText ||
          datatype === UITypes.Formula ||
          datatype === UITypes.Checkbox ||
          datatype === UITypes.Collaborator ||
          datatype === UITypes.Number
        ) {
          ncGroup.push({
            group_column_id: columnId,
            direction: group.order,
          });
        } else {
          // skip group by over other data types
          updateMigrationSkipLog(
            await sMap.getNcNameFromAtId(viewId),
            colSchema.title,
            colSchema.uidt,
            `group config skipped; group over ${datatype}  not supported`,
          );
          continue;
        }
      }

      // insert group
      const viewDetails = await this.viewColumnsService.columnList({
        viewId: viewId,
      });
      for (let i = 0; i < ncGroup.length; i++) {
        const ncViewColumnId = viewDetails.find(
          (x) => x.fk_column_id === ncGroup[i].group_column_id,
        )?.id;
        try {
          await this.gridColumnService.gridColumnUpdate({
            gridViewColumnId: ncViewColumnId,
            grid: {
              group_by: true,
              group_by_order: i + 1,
              group_by_sort:
                ncGroup[i].direction === 'ascending' ? 'asc' : 'desc',
            },
            req: {},
          });
        } catch (e) {
          // ignore
        }
      }
    };

    //////////////////////////////

    const nc_configureSort = async (viewId, s) => {
      for (let i = 0; i < s.sortSet.length; i++) {
        const columnId = (await nc_getColumnSchema(s.sortSet[i].columnId))?.id;

        if (columnId) {
          const _perfStart = recordPerfStart();
          await this.sortsService.sortCreate({
            viewId: viewId,
            sort: {
              fk_column_id: columnId,
              direction: s.sortSet[i].ascending ? 'asc' : 'desc',
            },
            req: {},
          });
          recordPerfStats(_perfStart, 'dbTableSort.create');
        }
        rtc.sort++;
      }
    };

    const nc_configureFields = async (
      _viewId,
      _c,
      tblName,
      viewName,
      viewType?,
    ) => {
      // force hide PK column
      const hiddenColumns = [ncSysFields.id, ncSysFields.hash];
      const c = _c.columnOrder;

      // column order corrections
      // retrieve table schema
      const ncTbl = await nc_getTableSchema(tblName);
      // retrieve view ID
      const viewId = ncTbl.views.find((x) => x.title === viewName).id;
      let viewDetails;

      const _perfStart = recordPerfStart();
      if (viewType === 'form') {
        viewDetails = (
          await this.formsService.formViewGet({ formViewId: viewId })
        ).columns;
        recordPerfStats(_perfStart, 'dbView.formRead');
      } else if (viewType === 'gallery') {
        viewDetails = (
          await this.galleriesService.galleryViewGet({
            galleryViewId: viewId,
          })
        ).columns;
        recordPerfStats(_perfStart, 'dbView.galleryRead');
      } else {
        viewDetails = await this.viewColumnsService.columnList({
          viewId: viewId,
        });
        recordPerfStats(_perfStart, 'dbView.gridColumnsList');
      }

      // nc-specific columns; default hide.
      for (let j = 0; j < hiddenColumns.length; j++) {
        const ncColumnId = ncTbl.columns.find(
          (x) => x.title === hiddenColumns[j],
        ).id;
        const ncViewColumnId = viewDetails.find(
          (x) => x.fk_column_id === ncColumnId,
        )?.id;
        if (ncViewColumnId === undefined) continue;

        // first two positions held by record id & record hash
        const _perfStart = recordPerfStart();
        await this.viewColumnsService.columnUpdate({
          viewId: viewId,
          columnId: ncViewColumnId,
          column: {
            show: false,
            order: j + 1 + c.length,
          },
          req: {},
        });
        recordPerfStats(_perfStart, 'dbViewColumn.update');
      }

      // rest of the columns from airtable- retain order & visibility property
      for (let j = 0; j < c.length; j++) {
        const ncColumnId = await sMap.getNcIdFromAtId(c[j].columnId);
        const ncViewColumnId = await nc_getViewColumnId(
          viewId,
          viewType,
          ncColumnId,
        );
        if (ncViewColumnId === undefined) continue;

        // first two positions held by record id & record hash
        const configData = { show: c[j].visibility, order: j + 1 };
        if (viewType === 'form') {
          if (_c?.metadata?.form?.fieldsByColumnId?.[c[j].columnId]) {
            const x = _c.metadata.form.fieldsByColumnId[c[j].columnId];
            const formData = { ...configData };
            if (x?.title) formData[`label`] = x.title;
            if (x?.required) formData[`required`] = x.required;
            if (x?.description) formData[`description`] = x.description;
            const _perfStart = recordPerfStart();
            await this.formColumnsService.columnUpdate({
              formViewColumnId: ncViewColumnId,
              formViewColumn: formData,
              req: {},
            });
            recordPerfStats(_perfStart, 'dbView.formColumnUpdate');
          }
        }
        const _perfStart = recordPerfStart();
        await this.viewColumnsService.columnUpdate({
          viewId: viewId,
          columnId: ncViewColumnId,
          column: configData,
          req: {},
        });
        recordPerfStats(_perfStart, 'dbViewColumn.update');
      }
    };

    ///////////////////////////////////////////////////////////////////////////////
    try {
      logBasic('SDK initialized');
      logDetailed('Base initialization started');
      // delete base if already exists

      logDetailed('Base initialized');

      logBasic('Retrieving Airtable schema');
      // read schema file
      const schema = await getAirtableSchema(syncDB);
      const aTblSchema = schema.tableSchemas;
      logDetailed('Base schema extraction completed');

      if (!syncDB.baseId) {
        if (!syncDB.baseName) throw new Error('Base name or id not provided');
        // create empty base
        await nocoCreateProject(syncDB.baseName);
        logDetailed('Base created');
      } else {
        await nocoGetProject(syncDB.baseId);
        syncDB.baseName = ncCreatedProjectSchema?.title;
        syncDB.sourceId =
          syncDB.sourceId || ncCreatedProjectSchema.sources[0].id;
        logDetailed('Getting existing base meta');
      }

      logBasic('Importing Tables...');
      // prepare table schema (source)
      await nocoCreateBaseSchema(aTblSchema);
      logDetailed('Table creation completed');

      logDetailed('Configuring Links');
      // add LTAR
      await nocoCreateLinkToAnotherRecord(aTblSchema);
      logDetailed('Migrating LTAR columns completed');

      if (syncDB.options.syncLookup) {
        logDetailed(`Configuring Lookup`);
        // add look-ups
        await nocoCreateLookups(aTblSchema);
        logDetailed('Migrating Lookup columns completed');
      }

      if (syncDB.options.syncRollup) {
        logDetailed('Configuring Rollup');
        // add roll-ups
        await nocoCreateRollup(aTblSchema);
        logDetailed('Migrating Rollup columns completed');

        if (syncDB.options.syncLookup) {
          logDetailed('Migrating Lookup form Rollup columns');
          // lookups for rollup
          await nocoLookupForRollup();
          logDetailed('Migrating Lookup form Rollup columns completed');
        }
      }
      logDetailed('Configuring Display Value column');
      // configure Display Value
      await nocoSetPrimary(aTblSchema);
      logDetailed('Configuring Display Value column completed');

      if (syncDB.options.syncUsers) {
        logBasic('Configuring User(s)');
        // add users
        await nocoAddUsers(schema);
        logDetailed('Adding users completed');
      }

      // hide-fields
      // await nocoReconfigureFields(aTblSchema);

      logBasic('Syncing views');
      // configure views
      await nocoConfigureGridView(syncDB, aTblSchema);
      await nocoConfigureFormView(syncDB, aTblSchema);
      await nocoConfigureGalleryView(syncDB, aTblSchema);
      logDetailed('Syncing views completed');

      if (syncDB.options.syncData) {
        try {
          const _perfStart = recordPerfStart();
          const ncTblList = { list: [] };
          ncTblList['list'] = await this.tablesService.getAccessibleTables({
            baseId: ncCreatedProjectSchema.id,
            sourceId: syncDB.sourceId,
            roles: { ...userRole, owner: true },
          });
          recordPerfStats(_perfStart, 'base.tableList');

          logBasic('Reading Records...');

          const recordsMap = {};

          for (let i = 0; i < ncTblList.list.length; i++) {
            // not a migrated table, skip
            if (
              undefined ===
              aTblSchema.find((x) => x.name === ncTblList.list[i].title)
            )
              continue;

            const _perfStart = recordPerfStart();
            const ncTbl: any =
              await this.tablesService.getTableWithAccessibleViews({
                tableId: ncTblList.list[i].id,
                user: { ...syncDB.user, base_roles: { owner: true } },
              });
            recordPerfStats(_perfStart, 'dbTable.read');

            recordsMap[ncTbl.id] = await importData({
              baseName: syncDB.baseId,
              table: ncTbl,
              atBase,
              logBasic,
              nocoBaseDataProcessing_v2,
              sDB: syncDB,
              logDetailed,
              services: {
                tableService: this.tablesService,
                bulkDataService: this.bulkDataAliasService,
              },
            });
            rtc.data.records += await recordsMap[ncTbl.id].getCount();

            logDetailed(`Data inserted from ${ncTbl.title}`);
          }

          logBasic('Configuring Record Links...');
          for (let i = 0; i < ncTblList.list.length; i++) {
            // not a migrated table, skip
            if (
              undefined ===
              aTblSchema.find((x) => x.name === ncTblList.list[i].title)
            )
              continue;

            // const ncTbl = await api.dbTable.read(ncTblList.list[i].id);
            const ncTbl: any =
              await this.tablesService.getTableWithAccessibleViews({
                tableId: ncTblList.list[i].id,
                user: { ...syncDB.user, base_roles: { owner: true } },
              });

            rtc.data.nestedLinks += await importLTARData({
              table: ncTbl,
              baseName: syncDB.baseId,
              atBase,
              fields: null, //Object.values(tblLinkGroup).flat(),
              logBasic,
              insertedAssocRef,
              logDetailed,
              records: recordsMap[ncTbl.id],
              atNcAliasRef,
              ncLinkMappingTable,
              syncDB,
              services: {
                tableService: this.tablesService,
                bulkDataService: this.bulkDataAliasService,
              },
            });
          }
        } catch (error) {
          logBasic(
            `There was an error while migrating data! Please make sure your API key is correct.`,
          );
          logBasic(`Data migration failed: ${error}`);
        }
      }
      if (generate_migrationStats) {
        await generateMigrationStats(aTblSchema);
      }
    } catch (e) {
      if (e.message) {
        this.telemetryService.sendEvent({
          evt_type: 'a:airtable-import:error',
          user_id: syncDB.user.id,
          email: syncDB.user.email,
          data: { error: e.message },
        });
        console.log(e);
        throw new Error(e.message);
      }
      throw e;
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}

export const getUniqueNameGenerator = (defaultName = 'name') => {
  const namesRef = {};

  return (initName: string = defaultName): string => {
    let name = initName === '_' ? defaultName : initName;
    let c = 0;
    while (name in namesRef) {
      name = `${initName}_${++c}`;
    }
    namesRef[name] = true;
    return name;
  };
};

export interface AirtableSyncConfig {
  syncId: string;
  baseURL: string;
  authToken: string;
  baseName?: string;
  baseId?: string;
  sourceId?: string;
  apiKey: string;
  appId?: string;
  shareId: string;
  user: UserType;
  options: {
    syncViews: boolean;
    syncData: boolean;
    syncRollup: boolean;
    syncLookup: boolean;
    syncFormula: boolean;
    syncAttachment: boolean;
  };
}
