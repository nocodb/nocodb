import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { NcError } from '../helpers/catchError';
import { CowriterListType, CowriterType } from 'nocodb-sdk';
import Cowriter from '../../models/Cowriter';
import { PagedResponseImpl } from '../helpers/PagedResponse';

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
  '/api/v1/cowriter/meta/tables/:tableId/generate/bulk',
  ncMetaAclMw(cowriterCreateBulk, 'cowriterCreateBulk')
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
