import 'mocha';

import request from 'supertest';

import init from '../../../init';
import { Base, Source } from '../../../../../src/models';
import { expect } from 'chai';

interface CreateBaseArgs {
  title?: string;
  description?: string;
  meta?: {
    iconColor?: string;
  };
}

export default function (API_VERSION: 'v3' | 'v2') {
  const isV3 = API_VERSION === 'v3';
  const isV2 = API_VERSION === 'v2';
  const isEE = !!process.env.EE;

  describe('Base', () => {
    let context: Awaited<ReturnType<typeof init>>;

    beforeEach(async () => {
      context = await init();
    });

    it('Creat & Retrieve Base', async () => {
      const base: Base = await createBase({
        title: 'Test Base',
        description: 'Test Description',
        meta: {
          iconColor: '#000000',
        },
      });
      const response = await request(context.app)
        .get(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send()
        .expect(200);

      const responseBase = response.body;

      matchBase(responseBase, base);
    });

    it('Update Base', async () => {
      const base: Base = await createBase({
        title: 'Test Base',
        description: 'Test Description',
        meta: {
          iconColor: '#000000',
        },
      });

      const NEW_TITLE = 'New Title';
      const NEW_DESCRIPTION = 'Updated Description';
      const NEW_COLOR = '#ffffff';

      const iconColorKey = isV2 ? 'iconColor' : 'icon_color';

      base.title = NEW_TITLE;
      if (isV3) {
        base.description = NEW_DESCRIPTION;
      }
      base.meta![iconColorKey] = NEW_COLOR;

      await request(context.app)
        .patch(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send({
          title: NEW_TITLE,
          description: NEW_DESCRIPTION, // Will take effect only in V3.
          meta: {
            [iconColorKey]: NEW_COLOR,
          },
        })
        .expect(200);

      let response = await request(context.app)
        .get(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send()
        .expect(200);
      matchBase(response.body, base);

      // JSON STRINGFIED VERSION
      await request(context.app)
        .patch(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send({
          title: NEW_TITLE,
          description: NEW_DESCRIPTION, // Will take effect only in V3.
          meta: JSON.stringify({
            [iconColorKey]: NEW_COLOR + 'abc',
          }),
        })
        .expect(200);
      response = await request(context.app)
        .get(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send()
        .expect(200);
      base.meta![iconColorKey] = NEW_COLOR + 'abc';

      matchBase(response.body, base);
    });

    it('Delete Base', async () => {
      const base: Base = await createBase({
        title: 'Test Base',
      });

      await request(context.app)
        .delete(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send()
        .expect(200);

      await request(context.app)
        .get(`/api/${API_VERSION}/meta/bases/${base.id}`)
        .set('xc-auth', context.token)
        .send()
        .expect(404);
    });

    function matchBase(responseBase: any, base: any) {
      expect(responseBase).to.haveOwnProperty('id'); // Should be in both V2 and V3
      expect(responseBase.id).to.eq(base.id);

      expect(responseBase).to.haveOwnProperty('title'); // Should be in both V2 and V3
      expect(responseBase.title).to.eq(base.title);

      expect(responseBase).to.haveOwnProperty('description'); // Should be in both V2 and V3
      expect(responseBase.description).to.eq(base.description);

      expect(responseBase).to.haveOwnProperty('meta'); // Should be in both V2 and V3
      expect(responseBase.meta).to.deep.eq(base.meta);

      if (isV3) {
        expect(responseBase.meta).to.not.have.key('iconColor'); // In V3, key should be 'icon_color'
      }

      expect(responseBase).to.haveOwnProperty('created_at'); // Should be in both V2 and V3
      expect(responseBase.created_at).to.eq(base.created_at);

      expect(responseBase).to.haveOwnProperty('updated_at'); // Should be in both V2 and V3
      expect(responseBase.updated_at).to.eq(base.updated_at);

      if (base.sources) {
        expect(responseBase).to.haveOwnProperty('sources');
        expect(responseBase.sources).to.haveOwnProperty('length');
        expect(responseBase.sources.length).to.eq(base.sources.length);

        if (base.sources.length > 0) {
          sortSourcesByBaseOrder(responseBase.sources, base.sources);
          for (let index = 0; index < base.sources.length; index++) {
            const baseSource = base.sources[index];
            const responseSource = responseBase.sources[index];

            expect(!!responseSource).to.eq(true);

            expect(responseSource).to.haveOwnProperty('id'); // Required in both V2 and V3
            expect(responseSource.id).to.eq(baseSource.id);

            expect(responseSource).to.haveOwnProperty('type'); // Required in both V2 and V3
            expect(responseSource.type).to.eq(baseSource.type);

            expect(responseSource).to.haveOwnProperty('is_schema_readonly'); // Required in both V2 and V3
            expect(responseSource.is_schema_readonly).to.eq(
              baseSource.is_schema_readonly,
            );

            expect(responseSource).to.haveOwnProperty('is_data_readonly'); // Required in both V2 and V3
            expect(responseSource.is_data_readonly).to.eq(
              baseSource.is_data_readonly,
            );

            if (isV2) {
              expect(responseSource).to.haveOwnProperty('base_id'); // Allowed only in V2
              expect(responseSource.base_id).to.eq(baseSource.base_id);

              expect(responseSource).to.haveOwnProperty('alias'); // Allowed only in V2
              expect(responseSource.alias).to.eq(baseSource.alias);

              expect(responseSource).to.haveOwnProperty('meta'); // Allowed only in V2
              expect(responseSource.meta).to.deep.eq(baseSource.meta);

              expect(responseSource).to.haveOwnProperty('is_meta'); // Allowed only in V2
              expect(responseSource.is_meta).to.eq(baseSource.is_meta);

              expect(responseSource).to.haveOwnProperty('inflection_column'); // Allowed only in V2
              expect(responseSource.inflection_column).to.eq(
                baseSource.inflection_column,
              );

              expect(responseSource).to.haveOwnProperty('inflection_table'); // Allowed only in V2
              expect(responseSource.inflection_table).to.eq(
                baseSource.inflection_table,
              );

              expect(responseSource).to.haveOwnProperty('created_at'); // Allowed only in V2
              expect(responseSource.created_at).to.eq(baseSource.created_at);

              expect(responseSource).to.haveOwnProperty('updated_at'); // Allowed only in V2
              expect(responseSource.updated_at).to.eq(baseSource.updated_at);

              expect(responseSource).to.haveOwnProperty('enabled'); // Allowed only in V2
              expect(responseSource.enabled).to.eq(baseSource.enabled);

              expect(responseSource).to.haveOwnProperty('order'); // Allowed only in V2
              expect(responseSource.order).to.eq(baseSource.order);

              expect(responseSource).to.haveOwnProperty('description'); // Allowed only in V2
              expect(responseSource.description).to.eq(baseSource.description);

              expect(responseSource).to.haveOwnProperty('erd_uuid'); // Allowed only in V2
              expect(responseSource.erd_uuid).to.eq(baseSource.erd_uuid);

              expect(responseSource).to.haveOwnProperty('deleted'); // Allowed only in V2
              expect(responseSource.deleted).to.eq(baseSource.deleted);

              expect(responseSource).to.haveOwnProperty('is_local'); // Allowed only in V2
              expect(responseSource.is_local).to.eq(baseSource.is_local);

              expect(responseSource).to.haveOwnProperty('fk_sql_executor_id'); // Allowed only in V2
              expect(responseSource.fk_sql_executor_id).to.eq(
                baseSource.fk_sql_executor_id,
              );

              expect(responseSource).to.haveOwnProperty('fk_workspace_id'); // Allowed only in V2
              expect(responseSource.fk_workspace_id).to.eq(
                baseSource.fk_workspace_id,
              );

              expect(responseSource).to.haveOwnProperty('fk_integration_id'); // Allowed only in V2
              expect(responseSource.fk_integration_id).to.eq(
                baseSource.fk_integration_id,
              );

              expect(responseSource).to.haveOwnProperty('is_encrypted'); // Allowed only in V2
              expect(responseSource.is_encrypted).to.eq(
                baseSource.is_encrypted,
              );

              expect(responseSource).to.haveOwnProperty('integration_title'); // Allowed only in V2
              expect(responseSource.integration_title).to.eq(
                baseSource.integration_title,
              );

              expect(responseSource).to.not.haveOwnProperty('integration_id');
              expect(responseSource).to.not.haveOwnProperty('title');
            } else if (isV3) {
              /**
               * ===============================================
               * Renaming of fk_integration_id -> integration_id
               * ===============================================
               */
              expect(responseSource).to.haveOwnProperty('integration_id'); // Allowed only in V3
              expect(responseSource.integration_id).to.eq(
                baseSource.fk_integration_id,
              );

              /**
               * ===============================================
               * Renaming of alias -> title
               * ===============================================
               */
              expect(responseSource).to.haveOwnProperty('title'); // Allowed only in V3
              expect(responseSource.title).to.eq(baseSource.alias);

              expect(responseSource).to.not.haveOwnProperty('base_id');
              expect(responseSource).to.not.haveOwnProperty('alias');
              expect(responseSource).to.not.haveOwnProperty('meta');
              expect(responseSource).to.not.haveOwnProperty('is_meta');
              expect(responseSource).to.not.haveOwnProperty(
                'inflection_column',
              );
              expect(responseSource).to.not.haveOwnProperty('inflection_table');
              expect(responseSource).to.not.haveOwnProperty('created_at');
              expect(responseSource).to.not.haveOwnProperty('updated_at');
              expect(responseSource).to.not.haveOwnProperty('enabled');
              expect(responseSource).to.not.haveOwnProperty('order');
              expect(responseSource).to.not.haveOwnProperty('description');
              expect(responseSource).to.not.haveOwnProperty('erd_uuid');
              expect(responseSource).to.not.haveOwnProperty('deleted');
              expect(responseSource).to.not.haveOwnProperty('is_local');
              expect(responseSource).to.not.haveOwnProperty(
                'fk_sql_executor_id',
              );
              expect(responseSource).to.not.haveOwnProperty('fk_workspace_id');
              expect(responseSource).to.not.haveOwnProperty(
                'fk_integration_id',
              );
              expect(responseSource).to.not.haveOwnProperty('is_encrypted');
              expect(responseSource).to.not.haveOwnProperty(
                'integration_title',
              );
            }
          }
        }
      } else {
        expect(responseBase).to.not.haveOwnProperty('sources');
      }

      if (isV2) {
        expect(responseBase).to.haveOwnProperty('is_meta'); // Should be only in V2
        expect(responseBase.is_meta).to.eq(base.is_meta);

        expect(responseBase).to.haveOwnProperty('prefix'); // Should be only in V2
        expect(responseBase.prefix).to.eq(base.prefix);

        expect(responseBase).to.haveOwnProperty('status'); // Should be only in V2
        expect(responseBase.status).to.eq(base.status);

        expect(responseBase).to.haveOwnProperty('color'); // Should be only in V2
        expect(responseBase.color).to.eq(base.color);

        expect(responseBase).to.haveOwnProperty('uuid'); // Should be only in V2
        expect(responseBase.uuid).to.eq(base.uuid);

        expect(responseBase).to.haveOwnProperty('password'); // Should be only in V2
        expect(responseBase.password).to.eq(base.password);

        expect(responseBase).to.haveOwnProperty('roles'); // Should be only in V2
        expect(responseBase.roles).to.eq(base.roles);

        expect(responseBase).to.haveOwnProperty('deleted'); // Should be only in V2
        expect(responseBase.deleted).to.eq(base.deleted);

        expect(responseBase).to.haveOwnProperty('order'); // Should be only in V2
        expect(responseBase.order).to.eq(base.order);

        expect(responseBase).to.haveOwnProperty('type'); // Should be only in V2
        expect(responseBase.type).to.eq(base.type);

        if (isEE) {
          expect(responseBase).to.haveOwnProperty('fk_workspace_id'); // Should be only in V2
          expect(responseBase.fk_workspace_id).to.eq(base.fk_workspace_id);
        }

        expect(responseBase).to.haveOwnProperty('is_snapshot'); // Should be only in V2
        expect(responseBase.is_snapshot).to.eq(base.is_snapshot);
      } else if (isV3) {
        expect(responseBase).to.not.haveOwnProperty('is_meta'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('prefix'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('status'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('color'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('uuid'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('password'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('roles'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('deleted'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('order'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('type'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('fk_workspace_id'); // Should be not present in V3
        expect(responseBase).to.not.haveOwnProperty('is_snapshot'); // Should be not present in V3
      }
    }

    // ===========================
    // ---------- UTILS ----------
    // ===========================

    async function createBase(baseArgs: CreateBaseArgs) {
      const response = await request(context.app)
        .post(
          isEE
            ? `/api/${API_VERSION}/meta/workspaces/${context.fk_workspace_id}/bases`
            : `/api/${API_VERSION}/meta/bases`,
        )
        .set('xc-auth', context.token)
        .send({
          ...baseArgs,
          meta: {
            ...baseArgs.meta,
            [isV3 ? 'icon_color' : 'iconColor']: baseArgs.meta?.iconColor,
          },
          ...(isEE ? { fk_workspace_id: context.fk_workspace_id } : {}),
        })
        .expect(201);
      return response.body;
    }

    function sortSourcesByBaseOrder(
      responseSources: Source[],
      baseSources: Source[],
    ) {
      // Create a map of the original sources by their paramId for quick lookup
      const baseSourceMap = new Map(
        baseSources.map((source, index) => [source.id!, index]),
      );

      // Sort responseBase.sources based on the order in base.sources
      responseSources.sort((a, b) => {
        const indexA = baseSourceMap.get(a.id!)!;
        const indexB = baseSourceMap.get(b.id!)!;

        return indexA - indexB;
      });
    }
  });
}
