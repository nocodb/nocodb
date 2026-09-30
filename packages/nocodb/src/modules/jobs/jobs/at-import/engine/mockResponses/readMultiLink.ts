// Schema fixture for several links between the same two tables, served by
// ATMockImportEngine for share id `shrMultiLinkMock`.
//
// Projects is imported first, so its three links each auto-create a symmetric
// column in MlAssets named after the parent table: `Projects`, `Projects1`,
// `Projects2`. MlAssets' own link field names are then applied onto those
// columns, and the one called `Projects` collides with a sibling still sitting
// on its auto name. Same envelope trick as ./readDisplayValue.
import { responseData as baseResponse } from './read';

const USER_ID = 'usr9GWEED0hhrQ3P7';

const gridView = (id: string) => ({
  id,
  name: 'Grid view',
  type: 'grid',
  personalForUserId: null,
  description: null,
  createdByUserId: USER_ID,
});

const link = (
  id: string,
  name: string,
  foreignTableId: string,
  symmetricColumnId: string,
) => ({
  id,
  name,
  type: 'foreignKey',
  typeOptions: {
    foreignTableId,
    relationship: 'many',
    unreversed: true,
    symmetricColumnId,
  },
  initialCreatedByUserId: USER_ID,
});

export const multiLinkTableSchemas = [
  {
    id: 'tblMlProjects',
    name: 'Projects',
    primaryColumnId: 'fldMlPrName',
    description: null,
    columns: [
      {
        id: 'fldMlPrName',
        name: 'Name',
        type: 'text',
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldMlPrDue',
        name: 'Due',
        type: 'date',
        typeOptions: { isDateTime: false, dateFormat: 'LL' },
        initialCreatedByUserId: USER_ID,
      },
      // Two Airtable choices share a name; nc keeps one option.
      {
        id: 'fldMlPrStage',
        name: 'Stage',
        type: 'select',
        typeOptions: {
          choices: {
            selMlStageActA: {
              id: 'selMlStageActA',
              name: 'Active',
              color: 'blue',
            },
            selMlStageActB: {
              id: 'selMlStageActB',
              name: 'Active',
              color: 'green',
            },
            selMlStageDone: {
              id: 'selMlStageDone',
              name: 'Done',
              color: 'gray',
            },
          },
          choiceOrder: ['selMlStageActA', 'selMlStageActB', 'selMlStageDone'],
        },
        initialCreatedByUserId: USER_ID,
      },
      link('fldMlPrReqDoc', 'Requirement Doc', 'tblMlAssets', 'fldMlAsProj2'),
      link('fldMlPrAssets', 'Assets', 'tblMlAssets', 'fldMlAsProj3'),
      link('fldMlPrAssets2', 'Assets 2', 'tblMlAssets', 'fldMlAsProj'),
      {
        id: 'fldMlPrAstCnt',
        name: 'Asset Count',
        type: 'count',
        typeOptions: { relationColumnId: 'fldMlPrAssets' },
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldMlPrAstName',
        name: 'Asset Name',
        type: 'lookup',
        typeOptions: {
          relationColumnId: 'fldMlPrAssets',
          foreignTableRollupColumnId: 'fldMlAsName',
        },
        initialCreatedByUserId: USER_ID,
      },
      // Two lookups over the same rollup: they only resolve once rollups
      // exist, and the second pass used to skip every other one.
      {
        id: 'fldMlPrAstPCnt',
        name: 'Asset Project Count',
        type: 'lookup',
        typeOptions: {
          relationColumnId: 'fldMlPrAssets2',
          foreignTableRollupColumnId: 'fldMlAsPrjCnt',
        },
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldMlPrReqPCnt',
        name: 'Req Doc Project Count',
        type: 'lookup',
        typeOptions: {
          relationColumnId: 'fldMlPrReqDoc',
          foreignTableRollupColumnId: 'fldMlAsPrjCnt',
        },
        initialCreatedByUserId: USER_ID,
      },
      // One-way link: Airtable creates no symmetric column, so the importer
      // has only `foreignTableId` to find the target table with.
      {
        id: 'fldMlPrOwner',
        name: 'Owner',
        type: 'foreignKey',
        typeOptions: {
          foreignTableId: 'tblMlPeople',
          relationship: 'many',
          unreversed: true,
        },
        initialCreatedByUserId: USER_ID,
      },
    ],
    views: [gridView('viwMlProjects')],
    viewOrder: ['viwMlProjects'],
  },
  {
    id: 'tblMlAssets',
    name: 'MlAssets',
    primaryColumnId: 'fldMlAsName',
    description: null,
    columns: [
      {
        id: 'fldMlAsName',
        name: 'Name',
        type: 'text',
        initialCreatedByUserId: USER_ID,
      },
      // Symmetric of the third Projects link, so it was auto-named `Projects2`
      // while the first link's symmetric column holds `Projects`.
      link('fldMlAsProj', 'Projects', 'tblMlProjects', 'fldMlPrAssets2'),
      {
        id: 'fldMlAsPrjCnt',
        name: 'Project Count',
        type: 'count',
        typeOptions: { relationColumnId: 'fldMlAsProj' },
        initialCreatedByUserId: USER_ID,
      },
      link('fldMlAsProj2', 'Projects 2', 'tblMlProjects', 'fldMlPrReqDoc'),
      link('fldMlAsProj3', 'Projects 3', 'tblMlProjects', 'fldMlPrAssets'),
    ],
    views: [gridView('viwMlAssets')],
    viewOrder: ['viwMlAssets'],
  },
  {
    id: 'tblMlPeople',
    name: 'MlPeople',
    primaryColumnId: 'fldMlPeName',
    description: null,
    columns: [
      {
        id: 'fldMlPeName',
        name: 'Name',
        type: 'text',
        initialCreatedByUserId: USER_ID,
      },
    ],
    views: [gridView('viwMlPeople')],
    viewOrder: ['viwMlPeople'],
  },
];

export const responseData = {
  ...baseResponse,
  data: {
    ...(baseResponse as any).data,
    tableSchemas: multiLinkTableSchemas,
  },
};
