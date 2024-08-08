import { expect } from 'chai'
import 'mocha'
import request from 'supertest'
import { IntegrationsType } from 'nocodb-sdk'
import { createProject } from '../../factory/base'
import init from '../../init'

function integrationTests() {
  let context

  beforeEach(async function() {
    console.time('#### integrationTests')
    context = await init()
    await createProject(context)
    console.timeEnd('#### integrationTests')
  })

  it('Create Integration', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    const response = await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)

    expect(response.body).to.have.property('id')
    expect(response.body).to.have.property('title')
    expect(response.body).to.have.property('meta')
    expect(response.body.meta).to.have.property('color')

    if (response.body.title !== title || response.body.meta.color !== color) {
      throw new Error('Integration creation failed')
    }
  })

  it('List Integrations', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)

    const response = await request(context.app)
      .get(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .expect(200)

    if (
      response.body.list[0].title !== 'Sakila01' ||
      response.body.list[0].meta.color !== '#4351E8'
    ) {
      throw new Error('Integration listing failed')
    }
  })

  it('Delete Integration', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    const integration = await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)
    await request(context.app)
      .delete(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)
  })

  it('Update Integration', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    const integration = await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)

    await request(context.app)
      .patch(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .send({ title: 'Sakila02', config: {}, type: IntegrationsType.Database })
      .expect(200)

    const response = await request(context.app)
      .get(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)

    if (response.body.title !== 'Sakila02') {
      throw new Error('Integration update failed')
    }
  })

  it('Update Integration Error Test', async () => {
    await request(context.app)
      .patch(`/api/v2/meta/integrations/xxxxxxxxx`)
      .set('xc-auth', context.token)
      .send({ title: 'Sakila02', config: {}, type: IntegrationsType.Database })
      .expect(404)
  })

  it('Delete Integration Error Test', async () => {
    await request(context.app)
      .delete(`/api/v2/meta/integrations/xxxxxxxxx`)
      .set('xc-auth', context.token)
      .expect(404)
  })

  it('Create Integration Error Test', async () => {
    await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send()
      .expect(400)
  })

  it('Create Integration Unauthorized User Test', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .send({
        title,
        meta: {
          color,
        },
      })
      .expect(401)
  })

  it('List Integration Unauthorized User Test', async () => {
    await request(context.app)
      .get(`/api/v2/meta/integrations`)
      .expect(401)
  })

  it('Update Integration - where multiple sources are using the integration', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    const integration = await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)

    await request(context.app)
      .patch(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .send({ title: 'Sakila02', config: {}, type: IntegrationsType.Database })
      .expect(200)

    const response = await request(context.app)
      .get(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)

    if (response.body.title !== 'Sakila02') {
      throw new Error('Integration update failed')
    }
  })

  it('Integration list based on user roles under workspace and base', async () => {
    const title = 'Sakila01'
    const color = '#4351E8'

    const integration = await request(context.app)
      .post(`/api/v2/meta/integrations`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
        config: {},
        type: IntegrationsType.Database,
      })
      .expect(201)

    await request(context.app)
      .patch(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .send({ title: 'Sakila02', config: {}, type: IntegrationsType.Database })
      .expect(200)

    const response = await request(context.app)
      .get(`/api/v2/meta/integrations/${integration.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)

    if (response.body.title !== 'Sakila02') {
      throw new Error('Integration update failed')
    }
  })
}

export default function() {
  describe('Integration', integrationTests)
}
