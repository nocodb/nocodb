import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { NcError } from '../helpers/catchError';
import { CowriterListType, CowriterType, UITypes } from 'nocodb-sdk';
import Cowriter from '../../models/Cowriter';
import Column from '../../models/Column';
import Model from '../../models/Model';
import Base from '../../models/Base';
import { getUniqueColumnAliasName } from '../helpers/getUniqueName';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from './columnApis';

const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export async function cowriterCreate(
  req: Request<any, CowriterType, CowriterType>,
  res: Response<CowriterType>
) {
  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: req.body.prompt_statement,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  if (response.data.choices.length === 0) {
    NcError.badRequest('Failed to generate output');
  }

  const output = response.data.choices[0].text;

  const cowriter = await Cowriter.insert({
    ...req.body,
    fk_model_id: req.params.tableId,
    created_by: (req as any).user.id,
    output,
  });
  res.json(cowriter);
}

export async function cowriterCreateBulk(
  _req: Request<any, CowriterType, CowriterType>,
  res: Response<CowriterType>
) {
  // TODO:
  res.json({});
}

export async function cowriterGenerateColumns(req, res) {
  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: `list the variables in ${req.body.title} and return it in a string separated by commas`,
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
    id: req.params.tableId,
  });

  const columns = await table.getColumns();

  const output = response.data.choices[0].text
    .replaceAll('\n\n', '')
    .replaceAll('"', '')
    .trim()
    .split(', ');

  console.log(output);

  const base = await Base.get(table.base_id);

  const sqlMgr = await ProjectMgrv2.getSqlMgr({
    id: base.project_id,
  });

  const newColumns: Column[] = [];
  // TODO: check if column exists
  await Promise.all(
    output.map(async (o) => {
      const title = getUniqueColumnAliasName(columns, o);
      const column = await Column.insert({
        title,
        column_name: o,
        fk_model_id: req.params.tableId,
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

  // TODO: return something meaningful
  res.json({ res: true });
}

export async function cowriterUpdate(req, res) {
  res.json(
    await Cowriter.update(req.params.cowriterId, {
      ...req.body,
    })
  );
}

export async function cowriterList(
  req: Request,
  res: Response<CowriterListType>
) {
  const cowriterList = await Cowriter.list({
    fk_model_id: req.params.tableId,
  });

  res.json(new PagedResponseImpl(cowriterList));
}

export async function cowriterGet(req: Request, res: Response) {
  const cowriter = await Cowriter.get(req.params.cowriterId);
  res.json(cowriter);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterCreate, 'cowriterCreate')
);

router.post(
  '/api/v1/cowriter/meta/tables/:tableId/bulk',
  ncMetaAclMw(cowriterCreateBulk, 'cowriterCreateBulk')
);

router.post(
  '/api/v1/cowriter/meta/tables/:tableId/generate-columns',
  ncMetaAclMw(cowriterGenerateColumns, 'cowriterGenerateColumns')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterList, 'cowriterList')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId/:cowriterId',
  ncMetaAclMw(cowriterGet, 'cowriterGet')
);

router.patch(
  '/api/v1/cowriter/meta/tables/:tableId/:cowriterId',
  ncMetaAclMw(cowriterUpdate, 'cowriterUpdate')
);

export default router;
