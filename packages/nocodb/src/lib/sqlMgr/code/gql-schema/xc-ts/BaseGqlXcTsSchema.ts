import BaseRender from "../../BaseRender";

class BaseGqlXcTsSchema extends BaseRender {

  /**
   *
   * @param dir
   * @param filename
   * @param ct
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({dir, filename, ctx}) {
    super({dir, filename, ctx});
  }

  protected generateManyToManyTypeProps(args: any): string {
    if (!args.manyToMany?.length) {
      return '';
    }
    let str = '\r\n';
    for (const mm of args.manyToMany) {
      str += `\t\t${mm._rtn}MMList: [${mm._rtn}]\r\n`;
    }
    return str;
  }

}


export default BaseGqlXcTsSchema;
