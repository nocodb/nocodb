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
            const filePermissions = require(file).permissions;

            const roles = Object.values(filePermissions)
              .flatMap(roles1 => Object.keys(roles1))
              .filter((v, i, arr) => arr.indexOf(v) === i);

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

            const policyFileContent = `module.exports.permissions = ${JSON.stringify(
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
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          if (models.includes(modelName) || models[0] === '$') {
            const filePermissions = require(file).permissions;

            if (users[0] === '$') {
              const roles = Object.values(filePermissions)
                .flatMap(methods =>
                  Object.values(methods).flatMap(roles1 => Object.keys(roles1))
                )
                .filter((v, i, arr) => arr.indexOf(v) === i);

              for (const [route, methods] of Object.entries(filePermissions)) {
                if (permissions[0] === '$=1') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = true;
                    return obj;
                  }, {});

                  for (const [method, rolesObj] of Object.entries(methods)) {
                    Object.assign(rolesObj, permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${roles.join(
                        ', '
                      )} method: ${method}=true, route: ${route}`
                    );
                  }
                } else if (permissions[0] === '$=0') {
                  const permObj = roles.reduce((obj, role) => {
                    obj[role] = false;
                    return obj;
                  }, {});
                  for (const [method, rolesObj] of Object.entries(methods)) {
                    Object.assign(rolesObj, permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${roles.join(
                        ', '
                      )} method: ${method}=false, route: ${route}`
                    );
                  }
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
                    if (methods[permTuple[0]]) {
                      Object.assign(methods[permTuple[0]], permObj);
                      console.log(
                        `Setting Permissions for model:${modelName} roles:${roles.join(
                          ', '
                        )} method: ${permTuple[0]}=${val}, route: ${route}`
                      );
                    }
                  });
                }
              }
            } else {
              for (const [route, methods] of Object.entries(filePermissions)) {
                permissions.forEach(permission => {
                  const permTuple = permission.split('=');
                  const val = !!(permTuple.length === 1
                    ? 1
                    : +permTuple[1] || 0);
                  const permObj = users.reduce((obj, role) => {
                    obj[role] = val;
                    return obj;
                  }, {});
                  if (methods[permTuple[0]]) {
                    Object.assign(methods[permTuple[0]], permObj);
                    console.log(
                      `Setting Permissions for model:${modelName} roles:${users.join(
                        ', '
                      )} method: ${permTuple[0]}=${val}, route: ${route}`
                    );
                  } else if (permTuple[0] === '*') {
                    for (const [method, rolesObj] of Object.entries(methods)) {
                      Object.assign(rolesObj, permObj);
                      console.log(
                        `Setting Permissions for model:${modelName} roles:${users.join(
                          ', '
                        )} method: ${method}=${val}, route: ${route}`
                      );
                    }
                  }
                });
              }
            }

            const policyFileContent = `module.exports.permissions = ${JSON.stringify(
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
          // let filePermissions = require(file).permissions;

          const modelName = path.basename(file).split('.')[0];

          if (models.includes(modelName)) {
            const filePermissions = require(file).permissions;

            roles = Object.values(filePermissions)
              .flatMap(roles1 => Object.keys(roles1))
              .filter((v, i, arr) => arr.indexOf(v) === i);

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
                row.push(methods[role] ? colors.green('✔️') : colors.red('x'));
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
          '*.policy.js'
        );

        // instantiate
        const table = new Table({
          head: ['Route', 'Role', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        });

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          if (models.includes(modelName)) {
            if (models.includes(modelName)) {
              const filePermissions: {
                readonly [key: string]: any;
              } = require(file).permissions;

              const roles = Object.values(filePermissions)
                .flatMap(methods =>
                  Object.values(methods).flatMap(roles1 => Object.keys(roles1))
                )
                .filter((v, i, arr) => arr.indexOf(v) === i);

              table.push([
                {
                  colSpan: 7,
                  content: colors.green(file),
                  hAlign: 'center'
                }
              ]);

              for (const [route, methods] of Object.entries(filePermissions)) {
                let i = 0;
                for (const role of roles) {
                  {
                    table.push([
                      ...(i++
                        ? []
                        : [
                            {
                              content: route,
                              rowSpan: roles.length,
                              vAlign: 'center'
                            }
                          ]),
                      role,
                      methods.get && methods.get[role]
                        ? colors.green('✔️')
                        : colors.red('x'),
                      methods.post && methods.post[role]
                        ? colors.green('✔️')
                        : colors.red('x'),
                      methods.put && methods.put[role]
                        ? colors.green('✔️')
                        : colors.red('x'),
                      methods.delete && methods.delete[role]
                        ? colors.green('✔️')
                        : colors.red('x'),
                      methods.patch && methods.patch[role]
                        ? colors.green('✔️')
                        : colors.red('x')
                    ] as any);
                  }
                }
              }
            }

            // console.log(`Model : ${modelName} \n${JSON.stringify(filePermissions, 0, 2)} `)
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

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(roles1 => Object.keys(roles1))
            .filter((v, i, arr) => arr.indexOf(v) === i);

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

          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
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
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(methods =>
              Object.values(methods).flatMap(roles1 => Object.keys(roles1))
            )
            .filter((v, i, arr) => arr.indexOf(v) === i);

          if (roles.includes(user)) {
            console.warn(`${user} already exist in ${modelName} policy`);
            return;
          }

          for (const methods of Object.values(filePermissions)) {
            for (const roles1 of Object.values(methods)) {
              roles1[user] = true;
            }
          }

          console.log(
            `Adding new role permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
            filePermissions,
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

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(roles1 => Object.keys(roles1))
            .filter((v, i, arr) => arr.indexOf(v) === i);

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

          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
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
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(methods =>
              Object.values(methods).flatMap(roles1 => Object.keys(roles1))
            )
            .filter((v, i, arr) => arr.indexOf(v) === i);

          if (!roles.includes(user)) {
            console.warn(`${user} not exist in ${modelName} policy`);
            return;
          }

          for (const methods of Object.values(filePermissions)) {
            for (const roles1 of Object.values(methods)) {
              delete roles1[user];
            }
          }

          console.log(
            `Deleting user permission for model:${modelName} roles:${user}`
          );

          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
            filePermissions,
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

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(roles1 => Object.keys(roles1))
            .filter((v, i, arr) => arr.indexOf(v) === i);

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
          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
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
          '*.policy.js'
        );

        glob.sync(policiesPath).forEach(file => {
          const modelName = path.basename(file).split('.')[0];

          const filePermissions = require(file).permissions;

          const roles = Object.values(filePermissions)
            .flatMap(methods =>
              Object.values(methods).flatMap(roles1 => Object.keys(roles1))
            )
            .filter((v, i, arr) => arr.indexOf(v) === i);

          if (!roles.includes(oldUser)) {
            console.warn(`${oldUser} not exist in ${modelName} policy`);
            return;
          }
          if (roles.includes(newUser)) {
            console.warn(`${newUser} is already exist in ${modelName} policy`);
            return;
          }

          for (const methods of Object.values(filePermissions)) {
            for (const roles1 of Object.values(methods)) {
              roles1[newUser] = roles1[oldUser];
              delete roles1[oldUser];
            }
          }

          console.log(
            `Renaming user permission ${oldUser} to ${newUser} for model:${modelName}`
          );
          const policyFileContent = `module.exports.permissions = ${JSON.stringify(
            filePermissions,
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
}

export default PermissionsMgr;
