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
    let handler = (args) => {
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
