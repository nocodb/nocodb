// Schema fixture for display-value selection, served by ATMockImportEngine for
// share id `shrDisplayValueMock`. One table per branch of `nocoSetPrimary`.
//
// Reuses the scraped envelope from ./read and swaps only `tableSchemas` —
// FetchAT streams ~50 sibling fields off `data`, and this keeps them intact
// without deep-copying 150KB.
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

const selectChoices = (choices: Array<{ id: string; name: string }>) => ({
  choices: Object.fromEntries(
    choices.map((c) => [c.id, { ...c, color: 'blue' }]),
  ),
  choiceOrder: choices.map((c) => c.id),
});

export const displayValueTableSchemas = [
  // Airtable primary field is a long text and nothing else in the table
  // qualifies -> a Title column is added and becomes the display value. This is
  // also the shape that used to throw and roll the whole import back.
  {
    id: 'tblDvNoEligible',
    name: 'DvNoEligible',
    primaryColumnId: 'fldDvNeNotes',
    description: null,
    columns: [
      {
        id: 'fldDvNeNotes',
        name: 'Notes',
        type: 'multilineText',
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldDvNeStatus',
        name: 'Status',
        type: 'select',
        typeOptions: selectChoices([
          { id: 'selDvNeTodo', name: 'Todo' },
          { id: 'selDvNeDone', name: 'Done' },
        ]),
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldDvNeAttach',
        name: 'Attachments',
        type: 'multipleAttachment',
        typeOptions: { unreversed: true },
        initialCreatedByUserId: USER_ID,
      },
    ],
    views: [gridView('viwDvNoEligible')],
    viewOrder: ['viwDvNoEligible'],
  },

  // Airtable primary field is a formula. Imported formulas are always the `""`
  // placeholder, so it is rejected and the display value falls to `Name`.
  {
    id: 'tblDvFormulaPrim',
    name: 'DvFormulaPrimary',
    primaryColumnId: 'fldDvFpCalc',
    description: null,
    columns: [
      {
        id: 'fldDvFpCalc',
        name: 'Calc',
        type: 'formula',
        typeOptions: {
          formulaTextParsed: 'CONCATENATE("row-", Name)',
          isValid: true,
          dependencies: { referencedColumnIdsForValue: ['fldDvFpName'] },
        },
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldDvFpName',
        name: 'Name',
        type: 'text',
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldDvFpNotes',
        name: 'Notes',
        type: 'multilineText',
        initialCreatedByUserId: USER_ID,
      },
    ],
    views: [gridView('viwDvFormulaPrim')],
    viewOrder: ['viwDvFormulaPrim'],
  },

  // Same as DvNoEligible, but a field is already called `Title` — the added
  // column must not collide with it.
  {
    id: 'tblDvTitleTaken',
    name: 'DvTitleTaken',
    primaryColumnId: 'fldDvTtNotes',
    description: null,
    columns: [
      {
        id: 'fldDvTtNotes',
        name: 'Notes',
        type: 'multilineText',
        initialCreatedByUserId: USER_ID,
      },
      {
        id: 'fldDvTtTitle',
        name: 'Title',
        type: 'select',
        typeOptions: selectChoices([
          { id: 'selDvTtOne', name: 'One' },
          { id: 'selDvTtTwo', name: 'Two' },
        ]),
        initialCreatedByUserId: USER_ID,
      },
    ],
    views: [gridView('viwDvTitleTaken')],
    viewOrder: ['viwDvTitleTaken'],
  },
];

export const responseData = {
  ...baseResponse,
  data: {
    ...(baseResponse as any).data,
    tableSchemas: displayValueTableSchemas,
  },
};
