import BaseRender from '../../BaseRender';

class ExpressXcPolicyGql extends BaseRender {
  /**
   *
   * @param dir
   * @param filename
   * @param ctx
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir = '', filename = '', ctx }) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  prepare(): any {
    let data = {};

    /* run of simple variable */
    data = this.ctx;

    return data;
  }

  getObject() {
    return {
      [`${this.ctx.tn_camelize}List`]: { admin: true, user: true, guest: true },
      [`${this.ctx.tn_camelize}Read`]: { admin: true, user: true, guest: true },
      [`${this.ctx.tn_camelize}Create`]: {
        admin: true,
        user: true,
        guest: false,
      },
      [`${this.ctx.tn_camelize}Update`]: {
        admin: true,
        user: true,
        guest: false,
      },
      [`${this.ctx.tn_camelize}Delete`]: {
        admin: true,
        user: true,
        guest: false,
      },
      [`${this.ctx.tn_camelize}Exists`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}FindOne`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}Count`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}Distinct`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}GroupBy`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}Aggregate`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}Distribution`]: {
        admin: true,
        user: true,
        guest: true,
      },
      [`${this.ctx.tn_camelize}CreateBulk`]: {
        admin: true,
        user: true,
        guest: false,
      },
      [`${this.ctx.tn_camelize}UpdateBulk`]: {
        admin: true,
        user: true,
        guest: false,
      },
      [`${this.ctx.tn_camelize}DeleteBulk`]: {
        admin: true,
        user: true,
        guest: false,
      },
    };
  }

  getFunctions() {
    return {
      [`${this.ctx.tn_camelize}List`]: [
        `
async function(args, {req,res,next}){
    return (await req.model.list(args)).map(o => {
      return new req.gqlType(o);
    });
}
      `,
      ],
      [`${this.ctx.tn_camelize}Read`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.readByPk(args.id);
    return new req.gqlType(data);
}
      `,
      ],
      [`${this.ctx.tn_camelize}Create`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.insert(args.data);
    return new req.gqlType(data); 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Update`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.updateByPk(args.id, args.data);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Delete`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.delByPk(args.id);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Exists`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.exists(args.id);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}FindOne`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.findOne(args);
    return new req.gqlType(data); 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Count`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.countByPk(args);
    return data.count; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Distinct`]: [
        `
async function(args, {req,res,next}){
    const data = (await req.model.distinct(args)).map(d => new req.gqlType(d));
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}GroupBy`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.groupBy(args);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Aggregate`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.aggregate(args);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}Distribution`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.distribution(args);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}CreateBulk`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.insertb(args.data);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}UpdateBulk`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.updateb(args.data);
    return data; 
}     
      `,
      ],
      [`${this.ctx.tn_camelize}DeleteBulk`]: [
        `
async function(args, {req,res,next}){
    const data = await req.model.delb(args.data);
    return data; 
}     
      `,
      ],
    };
  }
}

export default ExpressXcPolicyGql;
