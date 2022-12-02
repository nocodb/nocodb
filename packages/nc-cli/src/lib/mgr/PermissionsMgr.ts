/* tslint:disable:prefer-const */
import colors from 'colors';
import fs from 'fs';
import glob from 'glob';
import jsonfile from 'jsonfile';
import path from 'path';
import Util from '../util/Util';

import Table from 'cli-table3';

class PermissionsMgr {
  public static async set(args) {
    if (Util.isProjectGraphql()) {
      try {
        if (args._.length < 4) {
          console.warn('Invalid arguments for : xc permissions.set');
          return;
        }

        // @ts-ignore
        let [_, models, users, ...resolvers] = args._;
        models = models.split('.');
        users = users.split('.');

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          if (models.includes(modelName) || models[0] === '$') {
            const filePermissions = require(file);

            const roles = this.extractUniqueGqlPolicyRoles(filePermissions);

            if (users[0] === '$') {
              for (const [route, rolesObj] of Object.entries(filePermissions)) {
                if (resolvers[0] === '$=1') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = true;
                    return obj;
                  }, {});

                  Object.assign(rolesObj, permObj);
                  console.log(
                    `Setting Permissions for model:${modelName} roles:${roles.join(
                      ', '
                    )}  resolver: ${route}`
                  );
                } else if (resolvers[0] === '$=0') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = false;
                    return obj;
                  }, {});

                  Object.assign(rolesObj, permObj);
                  console.log(
                    `Setting Permissions for model:${modelName} roles:${roles.join(
                      ', '
                    )}  resolver: ${route}`
                  );
                } else {
                  resolvers.forEach(permission => {
                    const permTuple = permission.split('=');
                    if (route === permTuple[0]) {
                      const permObj = roles.reduce((obj, role) => {
                        const val = !!(permTuple.length === 1
                          ? 1
                          : +permTuple[1] || 0);
                        obj[role] = val;
                        return obj;
                      }, {});
                      Object.assign(rolesObj, permObj);
                      console.log(
                        `Setting Permissions for model:${modelName} roles:${roles.join(
                          ', '
                        )} , resolver: ${route}`
                      );
                    }
                  });
                }
              }
            } else {
              for (const [route, rolesObj] of Object.entries(filePermissions)) {
                resolvers.forEach(permission => {
                  const permTuple = permission.split('=');
                  if (route === permTuple[0] || permTuple[0] === '$') {
                    const permObj = users.reduce((obj, role) => {
                      const val = !!(permTuple.length === 1
                        ? 1
                        : +permTuple[1] || 0);
                      obj[role] = val;
                      return obj;
                    }, {});
                    Object.assign(rolesObj, permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${users} , resolver: ${route}`
                    );
                  }
                });
              }
            }

            const policyFileContent = `module.exports = ${JSON.stringify(
              filePermissions,
              null,
              2
            )};\n`;
            fs.writeFileSync(file, policyFileContent);
          }
        });
      } catch (e) {
        console.error(`Error in xc permissions.set`, e);
      }
    } else {
      try {
        if (args._.length < 4) {
          console.warn('Invalid arguments for : xc permissions.set');
          return;
        }

        // @ts-ignore
        let [_, models, users, ...permissions] = args._;

        models = models.split('.');
        users = users.split('.');

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.routes.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];
          if (models.includes(modelName) || models[0] === '$') {
            const routesList: Route[] = require(file);
            const roles = this.extractUniqueRoles(routesList);

            if (users[0] === '$') {
              for (const route of routesList) {
                if (permissions[0] === '$=1') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = true;
                    return obj;
                  }, {});
                  Object.assign(route.acl, permObj);
                  console.log(
                    `Setting Permissions for model:${modelName} roles:${roles.join(
                      ', '
                    )} method: ${route.type}=true, route: ${route.path}`
                  );
                } else if (permissions[0] === '$=0') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = false;
                    return obj;
                  }, {});
                  Object.assign(route.acl, permObj);
                  console.log(
                    `Setting Permissions for model:${modelName} roles:${roles.join(
                      ', '
                    )} method: ${route.type}=false, route: ${route.path}`
                  );
                } else {
                  permissions.forEach(permission => {
                    const permTuple = permission.split('=');
                    const val = !!(permTuple.length === 1
                      ? 1
                      : +permTuple[1] || 0);
                    const permObj = roles.reduce((obj, role) => {
                      obj[role] = val;
                      return obj;
                    }, {});
                    if (route.type === permTuple[0]) {
                      Object.assign(route.acl, permObj);
                      console.log(
                        `Setting Permissions for model:${modelName} roles:${roles.join(
                          ', '
                        )} method: ${permTuple[0]}=${val}, route: ${route.path}`
                      );
                    }
                  });
                }
              }
            } else {
              for (const route of routesList) {
                permissions.forEach(permission => {
                  const permTuple = permission.split('=');
                  const val = !!(permTuple.length === 1
                    ? 1
                    : +permTuple[1] || 0);
                  const permObj = users.reduce((obj, role) => {
                    obj[role] = val;
                    return obj;
                  }, {});

                  if (route.type === permTuple[0]) {
                    Object.assign(route.acl, permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${users.join(
                        ', '
                      )} method: ${permTuple[0]}=${val}, route: ${route.path}`
                    );
                  } else if (permTuple[0] === '*') {
                    Object.assign(route.acl, permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${users.join(
                        ', '
                      )} method: ${route.type}=${val}, route: ${route.path}`
                    );
                  }
                });
              }
            }

            const policyFileContent = `module.exports = ${JSON.stringify(
              routesList,
              null,
              2
            )};\n`;
            fs.writeFileSync(file, policyFileContent);
          }
        });
      } catch (e) {
        console.error(`Error in xc permissions.set`, e);
      }
    }
  }

  public static async get(args) {
    if (Util.isProjectGraphql()) {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.get');
          return;
        }

        let { 1: models } = args._;
        models = models.split('.');

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.policy.js'
        );

        // instantiate
        let rows: any[] = [];
        let roles: any[] = [];

        glob.sync(policiesPath).forEach(file => {
          // let filePermissions = require(file);

          const modelName = path.basename(file).split('.')[0];

          if (models.includes(modelName)) {
            const filePermissions = require(file);

            roles = this.extractUniqueGqlPolicyRoles(filePermissions);

            rows.push([
              {
                colSpan: roles.length + 1,
                content: colors.green(file),
                hAlign: 'center'
              }
            ]);

            for (const [route, methods] of Object.entries(filePermissions)) {
              const row: any[] = [{ content: route, vAlign: 'center' }];
              for (const role of roles) {
                row.push(methods[role] ? colors.green('✔') : colors.red('x'));
              }
              rows.push(row);
            }
          }
        });

        const table = new Table({
          head: ['Route', ...roles]
        });

        table.push(...rows);
        console.log(table.toString());
      } catch (e) {
        console.error(`Error in xc permissions.get`, e);
      }
    } else {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.get');
          return;
        }

        let { 1: models } = args._;
        models = models.split('.');

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.routes.js'
        );

        // instantiate
        const table = new Table({
          head: ['Route', 'Role', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        });

        glob
          .sync(policiesPath)
          .sort(this.sortFiles)
          .forEach(file => {
            const modelName = path.basename(file).split('.')[0];

            if (models.includes(modelName)) {
              const routesList: Route[] = require(file);
              const groupedRoutes = this.groupRoutes(routesList);

              // extract unique roles
              const roles = this.extractUniqueRoles(routesList);

              table.push([
                {
                  colSpan: 7,
                  content: colors.green(file),
                  hAlign: 'center'
                }
              ]);

              for (const [routePath, methods] of Object.entries(
                groupedRoutes
              )) {
                let i = 0;
                for (const role of roles) {
                  {
                    table.push([
                      ...(i++
                        ? []
                        : [
                            {
                              content: routePath,
                              rowSpan: roles.length,
                              vAlign: 'center'
                            }
                          ]),
                      role,
                      methods?.get?.acl?.[role]
                        ? colors.green('✔')
                        : colors.red('x'),
                      methods?.post?.acl?.[role]
                        ? colors.green('✔')
                        : colors.red('x'),
                      methods?.put?.acl?.[role]
                        ? colors.green('✔')
                        : colors.red('x'),
                      methods?.delete?.acl?.[role]
                        ? colors.green('✔')
                        : colors.red('x'),
                      methods?.patch?.acl?.[role]
                        ? colors.green('✔')
                        : colors.red('x')
                    ] as any);
                  }
                }
              }
            }
          });

        console.log(table.toString());
      } catch (e) {
        console.error(`Error in xc permissions.get`, e);
      }
    }
  }

  public static async userAdd(args) {
    if (Util.isProjectGraphql()) {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: user } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file);

          const roles = this.extractUniqueGqlPolicyRoles(filePermissions);

          if (roles.includes(user)) {
            console.warn(`${user} already exist in ${modelName} policy`);
            return;
          }

          for (const roles1 of Object.values(filePermissions)) {
            roles1[user] = true;
          }

          console.log(
            `Adding new role permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports = ${JSON.stringify(
            filePermissions,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.add`, e);
      }
    } else {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: user } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.routes.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const routes: Route[] = require(file);

          const roles = this.extractUniqueRoles(routes);

          if (roles.includes(user)) {
            console.warn(`${user} already exist in ${modelName} policy`);
            return;
          }

          for (const route of routes) {
            route.acl[user] = true;
          }

          console.log(
            `Adding new role permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports = ${JSON.stringify(
            routes,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.add`, e);
      }
    }
  }

  public static async userDelete(args) {
    if (Util.isProjectGraphql()) {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: user } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file);

          const roles = this.extractUniqueGqlPolicyRoles(filePermissions);

          if (!roles.includes(user)) {
            console.warn(`${user} not exist in ${modelName} policy`);
            return;
          }

          for (const roles1 of Object.values(filePermissions)) {
            delete roles1[user];
          }

          console.log(
            `Deleting user permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports = ${JSON.stringify(
            filePermissions,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.delete`, e);
      }
    } else {
      try {
        if (args._.length < 2) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: user } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.routes.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const routes: Route[] = require(file);

          const roles = this.extractUniqueRoles(routes);

          if (!roles.includes(user)) {
            console.warn(`${user} not exist in ${modelName} policy`);
            return;
          }

          for (const route of routes) {
            delete route.acl[user];
          }

          console.log(
            `Deleting user permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports = ${JSON.stringify(
            routes,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.delete`, e);
      }
    }
  }

  public static async userRename(args) {
    if (Util.isProjectGraphql()) {
      try {
        if (args._.length < 3) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: oldUser, 2: newUser } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file);

          const roles = this.extractUniqueGqlPolicyRoles(filePermissions);

          if (!roles.includes(oldUser)) {
            console.warn(`${oldUser} not exist in ${modelName} policy`);
            return;
          }
          if (roles.includes(newUser)) {
            console.warn(`${newUser} is already exist in ${modelName} policy`);
            return;
          }

          for (const roles1 of Object.values(filePermissions)) {
            roles1[newUser] = roles1[oldUser];
            delete roles1[oldUser];
          }

          console.log(
            `Renaming user permission ${oldUser} to ${newUser} for model:${modelName}`
          );
          const policyFileContent = `module.exports = ${JSON.stringify(
            filePermissions,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.delete`, e);
      }
    } else {
      try {
        if (args._.length < 3) {
          console.warn('Invalid arguments for : xc permissions.userAdd');
          return;
        }

        const { 1: oldUser, 2: newUser } = args._;

        /* get all policies */
        const policiesPath = path.join(
          process.cwd(),
          'server',
          PermissionsMgr.getPolicyPath(),
          '**',
          '*.routes.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const routes: Route[] = require(file);

          const roles = this.extractUniqueRoles(routes);

          if (!roles.includes(oldUser)) {
            console.warn(`${oldUser} not exist in ${modelName} policy`);
            return;
          }
          if (roles.includes(newUser)) {
            console.warn(`${newUser} is already exist in ${modelName} policy`);
            return;
          }

          for (const route of routes) {
            route.acl[newUser] = route.acl[oldUser];
            delete route.acl[oldUser];
          }

          console.log(
            `Renaming user permission ${oldUser} to ${newUser} for model:${modelName}`
          );
          const policyFileContent = `module.exports = ${JSON.stringify(
            routes,
            null,
            2
          )};\n`;
          fs.writeFileSync(file, policyFileContent);
        });
      } catch (e) {
        console.error(`Error in xc permissions.user.delete`, e);
      }
    }
  }

  public static getPolicyPath() {
    const projectConfig = jsonfile.readFileSync(
      path.join(process.cwd(), 'config.xc.json')
    );
    return projectConfig.meta.projectType === 'rest' ? 'routers' : 'resolvers';
  }

  private static extractUniqueGqlPolicyRoles(filePermissions) {
    return Object.values(filePermissions)
      .flatMap(roles1 => Object.keys(roles1))
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }

  private static extractUniqueRoles(routesList: Route[]) {
    const roles = routesList
      .flatMap(route => Object.keys(route.acl))
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return roles;
  }

  private static groupRoutes(routes: Route[]): GroupedRoutes {
    const groupedRoutes: GroupedRoutes = {};
    for (const route of routes) {
      groupedRoutes[route.path] = groupedRoutes[route.path] || {};
      groupedRoutes[route.path][route.type] = route;
    }
    return groupedRoutes;
  }

  private static sortFiles(file1: string, file2: string): number {
    return (
      ((file1.indexOf('.bt.') > -1 ? 1 : 0) ||
        (file1.indexOf('.hm.') > -1 ? 2 : 0)) -
      ((file2.indexOf('.bt.') > -1 ? 1 : 0) ||
        (file2.indexOf('.hm.') > -1 ? 2 : 0))
    );
  }
}

export default PermissionsMgr;

export interface Route {
  type: string;
  path: string;
  acl: {
    [key: string]: boolean;
  };
}

type httpMethods = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface GroupedRoutes {
  [key: string]: {
    [key in httpMethods]?: {
      type: string;
      path: string;
      acl: {
        [key: string]: boolean;
      };
    };
  };
}
