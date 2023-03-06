import { NcError } from '../meta/helpers/catchError';
import { CowriterType, UITypes } from 'nocodb-sdk';
import Cowriter from '../models/Cowriter';
import Column from '../models/Column';
import Model from '../models/Model';
import Base from '../models/Base';
import Project from '../models/Project';
import { getUniqueColumnAliasName } from '../meta/helpers/getUniqueName';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from './column.svc';

const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export async function cowriterCreate(param: {
  cowriter: CowriterType;
  tableId: string;
  userId: string;
}) {
  const table = await Model.get(param.tableId);

  await table.getColumns();

  const project = await Project.get(table.project_id);

  const formState = param.cowriter;

  const promptStatement =
    (typeof project.meta === 'string'
      ? JSON.parse(project.meta as string)
      : project.meta
    ).prompt_statement || '';

  // translate prompt statment by replacing {{col}} in the given template
  let translatedPromptStatement = promptStatement;

  table.columns.forEach((c) => {
    if (formState[c.title!]) {
      translatedPromptStatement = translatedPromptStatement.replaceAll(
        `{{${c.title}}}`,
        formState[c.title!]
      );
    }
  });

  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: translatedPromptStatement,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  if (response.data.choices.length === 0) {
    NcError.badRequest('Failed to generate output');
  }

  const output = response.data.choices[0].text.trim();

  const cowriter = await Cowriter.insert({
    ...param.cowriter,
    prompt_statement: promptStatement,
    prompt_statement_template: translatedPromptStatement,
    fk_model_id: param.tableId,
    created_by: param.userId,
    output,
  });
  return cowriter;
}

export async function cowriterGenerateColumns(param: {
  tableId: string;
  title: string;
}) {
  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: `list the variables in ${param.title} and return it in a string separated by commas`,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  if (response.data.choices.length === 0) {
    NcError.badRequest('Failed to generate output');
  }

  const table = await Model.getWithInfo({
    id: param.tableId,
  });

  const columns = await table.getColumns();

  const existingColumnNames = columns.map((c) => c.column_name);

  const output = response.data.choices[0].text
    .replaceAll('\n\n', '')
    .replaceAll('"', '')
    .trim()
    .split(', ')
    .filter((column_name) => !existingColumnNames.includes(column_name));

  if (output.length > 0) {
    const base = await Base.get(table.base_id);

    const sqlMgr = await ProjectMgrv2.getSqlMgr({
      id: base.project_id,
    });

    const newColumns: Column[] = [];

    await Promise.all(
      output.map(async (column_name) => {
        const title = getUniqueColumnAliasName(columns, column_name);
        const column = await Column.insert({
          title,
          column_name,
          fk_model_id: param.tableId,
          uidt: UITypes.SingleLineText,
          meta: {},
          dt: 'varchar',
          dtx: 'specificType',
          ct: 'varchar(45)',
          nrqd: true,
          rqd: false,
          ck: false,
          pk: false,
          un: false,
          ai: false,
          cdf: null,
          clen: 45,
          np: null,
          ns: null,
          dtxp: '45',
          dtxs: '',
          altered: 1,
          uip: '',
          uicn: '',
        });
        newColumns.push(column);
      })
    );

    if (newColumns.length > 0) {
      const originalColumns = columns.map((c) => ({
        ...c,
        cn: c.column_name,
      }));

      const tableUpdateBody = {
        ...table,
        tn: table.table_name,
        originalColumns,
        columns: [
          ...originalColumns,
          ...newColumns.map((c) => ({
            ...c,
            cn: c.column_name,
            altered: Altered.NEW_COLUMN,
          })),
        ],
      };

      await sqlMgr.sqlOpPlus(base, 'tableUpdate', tableUpdateBody);
    }

    await table.getColumns();
  }

  return table;
}

export async function cowriterUpdate(param: {
  cowriterId: string;
  cowriter: Partial<CowriterType>;
}) {
  return await Cowriter.update(param.cowriterId, param.cowriter);
}

export async function cowriterList(param: { tableId: string }) {
  const cowriterList = await Cowriter.list({
    fk_model_id: param.tableId,
  });

  return new PagedResponseImpl(cowriterList);
}

export async function cowriterGet(param: { cowriterId: string }) {
  const cowriter = await Cowriter.get(param.cowriterId);
  return cowriter;
}
