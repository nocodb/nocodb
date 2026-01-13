const airtableApiBases = [
  'https://airtable.com/appZtc5xOWQkUL4Ok/shrrfpcWoNa5QGGSI',
  'https://airtable.com/appBnSP4VbJtKTTHB/shrfiNNg3yk9A0APu',
  'https://airtable.com/appPFK0xj5jTQR6wQ/shr6zjJvrUbSvfGPq',
  'https://airtable.com/apprb2mFeIlQitU0o/shrY6swT2FOy9X1Bl',
];
const today = new Date();

const airtableApiKey = 'pat23tPxwKmp4P96z.6b96f6381ad1bf2abdbd09539ac64fdb898516693603137b66e1e4e5a41bca78';
const airtableApiBase = airtableApiBases[today.getDate() % airtableApiBases.length];

const defaultBaseName = 'Base';

export { airtableApiKey, airtableApiBase, defaultBaseName };
