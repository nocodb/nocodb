import { Router } from 'express'
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw'
import getSwaggerHtml from './swaggerHtml'
import getRedocHtml from './redocHtml'
import { swaggerService } from '../../services'

async function swaggerJson(req, res) {
  const swagger = await swaggerService.swaggerJson({
    projectId: req.params.projectId,
    siteUrl: req.ncSiteUrl,
  })

  res.json(swagger)
}

function swaggerHtml(_, res) {
  res.send(getSwaggerHtml({ ncSiteUrl: process.env.NC_PUBLIC_URL || '' }))
}

function redocHtml(_, res) {
  res.send(getRedocHtml({ ncSiteUrl: process.env.NC_PUBLIC_URL || '' }))
}

const router = Router({ mergeParams: true })

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  ncMetaAclMw(swaggerJson, 'swaggerJson'),
)

router.get('/api/v1/db/meta/projects/:projectId/swagger', swaggerHtml)

router.get('/api/v1/db/meta/projects/:projectId/redoc', redocHtml)

export default router
