export default class GqlBaseResolver {
  constructor() {}

  // todo: type correction
  public static applyMiddlewares(
    handlers: any[] = [],
    resolvers = {},
    postHandlers: any[] = []
  ): any {
    if (!handlers) {
      return resolvers;
    }
    for (const [name, resolver] of Object.entries(resolvers)) {
      resolvers[name] = async (...args) => {
        try {
          for (const handler of handlers) {
            await handler(...args);
          }
          const result = await (resolver as any)(...args);
          if (postHandlers) {
            for (const handler of postHandlers) {
              await handler(result, ...args);
            }
          }
          return result;
        } catch (e) {
          throw e;
        }
      };
    }
    return resolvers;
  }

  protected generateResolverFromStringBody(fnBody: string[]): any {
    if (!(fnBody && Array.isArray(fnBody) && fnBody.length)) {
      return;
    }
    // @ts-ignore
    let handler = args => {
      return null;
    };

    try {
      const js = `((${fnBody}).bind(this))`;

      // const js = tsc.transpile(`((async function(args,{req,res,next}){
      //     ${fnBody}
      // }).bind(this))`, {
      //   strict: true,
      //   strictPropertyInitialization: true,
      //   strictNullChecks: true,
      // });

      // tslint:disable-next-line:no-eval
      handler = eval(js);
      // console.timeEnd('startTrans')
    } catch (e) {
      console.log('Error in transpilation', e);
    }

    // tslint:disable-next-line:no-eval

    return handler;
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
