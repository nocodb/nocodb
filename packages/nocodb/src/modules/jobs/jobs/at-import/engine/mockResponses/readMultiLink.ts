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
      link('fldMlPrReqDoc', 'Requirement Doc', 'tblMlAssets', 'fldMlAsProj2'),
      link('fldMlPrAssets', 'Assets', 'tblMlAssets', 'fldMlAsProj3'),
      link('fldMlPrAssets2', 'Assets 2', 'tblMlAssets', 'fldMlAsProj'),
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
      link('fldMlAsProj2', 'Projects 2', 'tblMlProjects', 'fldMlPrReqDoc'),
      link('fldMlAsProj3', 'Projects 3', 'tblMlProjects', 'fldMlPrAssets'),
    ],
    views: [gridView('viwMlAssets')],
    viewOrder: ['viwMlAssets'],
  },
];

export const responseData = {
  ...baseResponse,
  data: {
    ...(baseResponse as any).data,
    tableSchemas: multiLinkTableSchemas,
  },
};
