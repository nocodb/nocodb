import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk';

import init from '../../../init';
import { BaseUser } from '../../../../../src/models';
import { randomTokenString } from '../../../../../src/helpers/stringHelpers';
import type { Base, Source, User } from '../../../../../src/models';

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

  describe(`Base ${API_VERSION}`, () => {
    let context: Awaited<ReturnType<typeof init>>;

    beforeEach(async () => {
      context = await init();
    });

    it(`Create & Retrieve Base ${API_VERSION}`, async () => {
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

    it(`Update Base ${API_VERSION}`, async () => {
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

    it(`Delete Base ${API_VERSION}`, async () => {
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

    it(`List Base Users ${API_VERSION}`, async () => {
      const base: Base = await createBase({
        title: 'Test Base',
        description: 'Test Description',
        meta: {
          iconColor: '#000000',
        },
      });

      const testData = [...Array(30).keys()].map((i) => ({
        displayName: `Test User${i}`,
        email: `test-user${i}@nocotest.com`,
        invite_token: uuidv4(),
      }));

      const User = (
        await import(`../../../../../src${isEE ? '/ee' : ''}/models/User`)
      ).default;

      const users = await Promise.all(
        testData.map((testData) =>
          User.insert({
            invite_token: testData.invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email: testData.email,
            display_name: testData.displayName,
            roles: OrgUserRoles.VIEWER,
            token_version: randomTokenString(),
          }),
        ),
      );

      if (isEE) {
        const WorkspaceUser = (
          await import('../../../../../src/ee/models/WorkspaceUser')
        ).default;
        await Promise.all(
          users.map((user) =>
            WorkspaceUser.insert({
              fk_workspace_id: context.fk_workspace_id,
              fk_user_id: user.id,
              roles: 'workspace-level-viewer',
              invited_by: context.user!.id,
            }),
          ),
        );
      }

      const baseUsers = await Promise.all(
        users.map((user) =>
          BaseUser.insert(
            {
              workspace_id: context.fk_workspace_id,
              base_id: base.id,
            },
            {
              fk_workspace_id: context.fk_workspace_id,
              base_id: base.id,
              fk_user_id: user.id,
              roles: ProjectRoles.COMMENTER,
              invited_by: context.user!.id,
            },
          ),
        ),
      );

      const response = await request(context.app)
        .get(`/api/${API_VERSION}/meta/bases/${base.id}/users`)
        .set('xc-auth', context.token)
        .send()
        .expect(200);

      let usersResponseList: any[] = [];
      if (isV2) {
        usersResponseList = response.body.users.list;
        // expect(usersResponseList.length).to.eq(25);
      } else if (isV3) {
        usersResponseList = response.body.list;
        expect(usersResponseList.length).to.eq(31);
      }

      if (isV2) {
        expect(response.body.list).to.haveOwnProperty('pageInfo');
        expect(response.body.pageInfo).to.deep.eq({
          totalRows: 31,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: false,
        });
      } else {
        expect(response.body).to.not.haveOwnProperty('pageInfo');
        expect(response.body.list).to.not.haveOwnProperty('pageInfo');
      }

      usersResponseList.forEach((responseBaseUser) => {
        const baseUser = baseUsers.find(
          // @ts-expect-error type not present, but data present
          (bu) => bu.id === responseBaseUser.id,
        )!;
        if (responseBaseUser.roles === 'owner') return; // skip testing for org level user;
        const underlyingUser = users.find((u) => u.id === responseBaseUser.id)!;

        if (baseUser) matchBaseUser(responseBaseUser, baseUser, underlyingUser);
      });
    });

    it(`Create, Update and Delete Base Users ${API_VERSION}`, async () => {
      const base: Base = await createBase({
        title: 'Test Base',
        description: 'Test Description',
        meta: {
          iconColor: '#000000',
        },
      });

      const TEST_EMAILS = [...Array(5).keys()].map(
        (i) => `test-crud${i}@nocodb.com`,
      );
      const createUserArgsList: any[] = [];

      TEST_EMAILS.forEach((TEST_EMAIL) => {
        const createUserArgs: any = {
          email: TEST_EMAIL,
        };

        if (isV2) {
          createUserArgs.roles = ProjectRoles.COMMENTER;
        } else if (isV3) {
          createUserArgs.base_role = ProjectRoles.COMMENTER;
        }

        createUserArgsList.push(createUserArgs);
      });

      await request(context.app)
        .post(`/api/${API_VERSION}/meta/bases/${base.id}/users`)
        .set('xc-auth', context.token)
        .send(isV2 ? createUserArgsList[0] : createUserArgsList)
        .expect(isV3 ? 201 : 200);

      // todo: extract using api here
      const users: any[] = (await fetchUsersFromBase(base.id)).filter((u) =>
        (u.email as string).startsWith('test-crud'),
      );

      if (isV2) {
        expect(users.length).to.eq(1);
        const addedUser = users.find((u) => u.email === TEST_EMAILS[0]);

        expect(!!addedUser).to.eq(true);
        expect(addedUser.email).to.eq(TEST_EMAILS[0]);
        expect(addedUser.roles).to.eq(ProjectRoles.COMMENTER);

        if (isEE) {
          expect(addedUser.workspace_roles).to.eq(
            `workspace-level-${ProjectRoles.NO_ACCESS}`,
          );
        }
      } else if (isV3) {
        expect(users.length).to.eq(5);
        for (let index = 0; index < TEST_EMAILS.length; index++) {
          const TEST_EMAIL = TEST_EMAILS[index];
          const addedUser = users.find((u) => u.email === TEST_EMAIL);

          expect(!!addedUser).to.eq(true);
          expect(addedUser.email).to.eq(TEST_EMAILS[0]);
          expect(addedUser.base_role).to.eq(ProjectRoles.COMMENTER);

          if (isEE) {
            expect(addedUser.workspace_role).to.eq(
              `workspace-level-${ProjectRoles.NO_ACCESS}`,
            );
          }
        }
      }

      const updateQueries = [
        {
          id: users[0].id,
          email: 'test-crud-new@nocodb.com',
          [isV3 ? 'base_role' : 'roles']: ProjectRoles.EDITOR,
        },
      ];

      if (isV2) {
        await request(context.app)
          .patch(
            `/api/${API_VERSION}/meta/bases/${base.id}/users/${updateQueries[0].id}`,
          )
          .set('xc-auth', context.token)
          .send(updateQueries[0])
          .expect(200);
      } else if (isV3) {
        await request(context.app)
          .patch(`/api/${API_VERSION}/meta/bases/${base.id}/users`)
          .set('xc-auth', context.token)
          .send(updateQueries)
          .expect(200);
      }

      const usersUpdated = await fetchUsersFromBase(base.id);
      const updatedUser = usersUpdated.find(
        (u) => u.id === updateQueries[0].id,
      );

      expect(!!updatedUser).to.eq(true);
      expect(updatedUser.email).to.eq('test-crud0@nocodb.com'); // Check that email should NOT have been updated

      if (isV2) {
        expect(updatedUser.roles).to.eq(ProjectRoles.EDITOR);
      } else if (isV3) {
        expect(updatedUser.base_role).to.eq(ProjectRoles.EDITOR);
      }

      if (isEE && isV3) {
        expect(updatedUser.workspace_roles).to.eq(
          `workspace-level-${ProjectRoles.NO_ACCESS}`,
        );
      }

      const deleteQueries = [
        {
          id: updatedUser.id,
        },
        {
          email: `test-crud1@nocodb.com`,
        },
      ];

      if (isV2) {
        // Need to iterate for v2, but v3 should support bulk delete by default
        await request(context.app)
          .delete(
            `/api/${API_VERSION}/meta/bases/${base.id}/users/${updatedUser.id}`,
          )
          .set('xc-auth', context.token)
          .expect(200);
      } else if (isV3) {
        await request(context.app)
          .delete(`/api/${API_VERSION}/meta/bases/${base.id}/users`)
          .set('xc-auth', context.token)
          .send(deleteQueries)
          .expect(200);
      }

      const availableUsers = (await fetchUsersFromBase(base.id)).filter((u) =>
        (u.email as string).startsWith('test-crud'),
      );

      if (isV3) {
        expect(availableUsers.length).to.eq(3); // 2 deleted out of 5
      } else if (isV2) {
        expect(availableUsers.length).to.eq(0); // 1 deleted out of 1
      }
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

    function matchBaseUser(
      responseBaseUser: any,
      baseUser: BaseUser,
      underlyingUser: User,
      isDeleted: boolean = false,
    ) {
      expect(responseBaseUser).to.haveOwnProperty('id');
      expect(responseBaseUser.id).to.eq(underlyingUser.id);

      expect(responseBaseUser).to.haveOwnProperty('email');
      expect(responseBaseUser.email).to.eq(underlyingUser.email);

      if (underlyingUser.display_name) {
        const prop = isV3 ? 'name' : 'display_name';
        expect(responseBaseUser).to.haveOwnProperty(prop);
        expect(responseBaseUser[prop]).to.eq(underlyingUser.display_name);
      }

      expect(responseBaseUser).to.haveOwnProperty('created_at');

      if (isV2) {
        expect(responseBaseUser).to.haveOwnProperty('invite_token');
        expect(responseBaseUser.invite_token).to.eq(
          underlyingUser.invite_token,
        );

        expect(responseBaseUser).to.haveOwnProperty('main_roles');
        expect(responseBaseUser.main_roles).to.eq(underlyingUser.roles);

        expect(responseBaseUser).to.haveOwnProperty('base_id');
        expect(responseBaseUser.base_id).to.eq(baseUser.base_id);

        expect(responseBaseUser).to.haveOwnProperty('roles');
        expect(responseBaseUser.roles).to.eq(baseUser.roles);
      } else if (isV3) {
        expect(responseBaseUser).to.not.haveOwnProperty('invite_token');
        expect(responseBaseUser).to.not.haveOwnProperty('main_roles');
        expect(responseBaseUser).to.not.haveOwnProperty('base_id');
        expect(responseBaseUser).to.not.haveOwnProperty('roles');

        expect(responseBaseUser).to.haveOwnProperty('base_role');
        expect(responseBaseUser.base_role).to.eq(baseUser.roles);
      }

      if (isEE) {
        expect(responseBaseUser).to.haveOwnProperty('workspace_id');
        expect(responseBaseUser.workspace_id).to.eq(context.fk_workspace_id);

        if (isV2) {
          expect(responseBaseUser).to.haveOwnProperty('workspace_roles');
          expect(responseBaseUser.workspace_roles).to.eq(
            'workspace-level-viewer',
          );

          expect(responseBaseUser).to.haveOwnProperty('deleted');
          expect(responseBaseUser.deleted).to.eq(isDeleted);
        } else if (isV3) {
          expect(responseBaseUser).to.not.haveOwnProperty('workspace_roles');
          expect(responseBaseUser).to.not.haveOwnProperty('deleted');

          expect(responseBaseUser).to.haveOwnProperty('workspace_role');
          expect(responseBaseUser.workspace_role).to.eq(
            'workspace-level-viewer',
          );
        }
      }
    }

    async function fetchUsersFromBase(baseId: string): Promise<any[]> {
      if (isEE) {
        const BaseUser = (await import('../../../../../src/ee/models/BaseUser'))
          .default;
        return BaseUser.getUsersList(
          { workspace_id: context.fk_workspace_id },
          {
            base_id: baseId,
            mode: 'viewer',
          },
        );
      } else {
        return BaseUser.getUsersList(context, {
          base_id: baseId,
          mode: 'viewer',
        });
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
        .expect(isEE ? 201 : isV3 ? 201 : 200);
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
