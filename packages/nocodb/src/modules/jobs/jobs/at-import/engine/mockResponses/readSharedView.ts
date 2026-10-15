// Shared view payload, served by ATMockImportEngine for share id
// `shrSharedViewMock`. One table, its shared view and its rows in Airtable's
// internal format; see helpers/sharedView.ts.

const USER_ID = 'usrSvOwner';

const VIEW_ID = 'viwSvMock';

export const responseData = {
  msg: 'SUCCESS',
  data: {
    table: {
      id: 'tblSvMock',
      // Airtable masks the table name in view shares
      name: 'Shared view table',
      primaryColumnId: 'fldSvName',
      description: null,
      appBlanket: {
        userInfoById: {
          [USER_ID]: { id: USER_ID, firstName: 'Ada', lastName: 'Lovelace' },
        },
      },
      signedUserContentUrls: {},
      columns: [
        { id: 'fldSvName', name: 'Name', type: 'text' },
        {
          id: 'fldSvStatus',
          name: 'Status',
          type: 'select',
          typeOptions: {
            choiceOrder: ['selSvOpen', 'selSvDone'],
            choices: {
              selSvOpen: { id: 'selSvOpen', name: 'Open', color: 'blue' },
              selSvDone: { id: 'selSvDone', name: 'Done', color: 'green' },
            },
          },
        },
        {
          id: 'fldSvScore',
          name: 'Score',
          type: 'number',
          typeOptions: { format: 'integer', negative: false },
        },
        { id: 'fldSvOwner', name: 'Owner', type: 'collaborator' },
        {
          id: 'fldSvLink',
          name: 'Project',
          type: 'foreignKey',
          typeOptions: {
            foreignTableId: 'tblSvOther',
            relationship: 'many',
            symmetricColumnId: 'fldSvOtherBack',
          },
        },
        {
          id: 'fldSvTotal',
          name: 'Total',
          type: 'formula',
          typeOptions: {
            formulaTextParsed: 'column_value_fldSvScore * 2',
            resultType: 'number',
            precision: 0,
          },
        },
        {
          id: 'fldSvComputed',
          name: 'Summary',
          type: 'computation',
          typeOptions: { resultType: 'text' },
        },
        { id: 'fldSvAi', name: 'AI note', type: 'asyncText' },
        { id: 'fldSvSort', name: 'Manual', type: 'manualSort' },
      ],
      views: [
        {
          id: VIEW_ID,
          name: 'Open tasks',
          type: 'grid',
          columnOrder: [
            'fldSvName',
            'fldSvStatus',
            'fldSvScore',
            'fldSvOwner',
            'fldSvLink',
            'fldSvTotal',
            'fldSvComputed',
            'fldSvAi',
          ].map((columnId) => ({ columnId, visibility: true })),
          filters: null,
          lastSortsApplied: null,
          groupLevels: null,
          rowOrder: [
            { rowId: 'recSvC', visibility: true },
            { rowId: 'recSvA', visibility: true },
            // hidden by the view's filter
            { rowId: 'recSvHidden', visibility: false },
            // listed, but not in the payload
            { rowId: 'recSvMissing', visibility: true },
          ],
        },
      ],
      rows: [
        {
          id: 'recSvA',
          cellValuesByColumnId: {
            fldSvName: 'Alpha',
            fldSvStatus: 'selSvOpen',
            fldSvScore: 0,
            fldSvOwner: USER_ID,
            fldSvLink: [
              { foreignRowId: 'recSvP1', foreignRowDisplayName: 'Apollo' },
            ],
            fldSvTotal: 0,
            fldSvComputed: 'alpha summary',
            fldSvAi: { state: 'generated', value: 'ai alpha' },
            fldSvSort: 1,
          },
        },
        {
          id: 'recSvHidden',
          cellValuesByColumnId: { fldSvName: 'Hidden', fldSvScore: 9 },
        },
        {
          id: 'recSvC',
          cellValuesByColumnId: {
            fldSvName: 'Charlie',
            fldSvStatus: 'selSvDone',
            fldSvScore: 3,
            fldSvTotal: 6,
          },
        },
        // not in the view's row order
        {
          id: 'recSvUnlisted',
          cellValuesByColumnId: { fldSvName: 'Unlisted', fldSvScore: 5 },
        },
      ],
    },
  },
};
