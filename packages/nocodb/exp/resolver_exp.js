const delay = t => new Promise(res => setTimeout(() => res(), t))

const time = 1000;
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    user: 'root',
    password: 'password',
    database: 'sakila'
  }
});


class Country {
  constructor(data) {
    Object.assign(this, data)
  }

  async cityList() {
    return (await knex('city').select('*').where({
      country_id: this.country_id
    }).limit(1)).map(c => new City(c))
  }

  async cityCount() {
    return (await knex('city').count('city_id as count').where({
      country_id: this.country_id
    }).first()).count
  }

  async addressCount(args) {

    return await Promise.all(args.map(c => c.addressCount()))

    // return (await knex('city').count('city_id as count').where({
    //   country_id: this.country_id
    // }).first()).count
  }

  async addressList(args) {

    return await Promise.all((await this.cityList()).map(c => c.addressList()))

    // return (await knex('city').count('city_id as count').where({
    //   country_id: this.country_id
    // }).first()).count
  }
}


class Address {
  constructor(data) {
    Object.assign(this, data)
  }
}

class City {
  constructor(data) {
    Object.assign(this, data)
  }

  async countryRead() {
    return new Country((await knex('country').select('*').where({
      country_id: this.country_id
    }).first()))
  }

  /*  async addressList() {
      return (await knex('address').select('*').where({
        city_id: this.city_id
      })).map(c => new Address(c))
    }*/

  /*  async addressCount() {
      return (await knex('address').count('city_id as count').where({
        city_id: this.city_id
      }).first()).count
    }*/


}


// const nestResolver = {
//   country: `INDIA`,
//   async cityCount() {
//     await delay(time)
//     return `12-${time}`
//   },
//   async cityList() {
//     await delay(time)
//     return {
//       city: `city 1-${time}`,
//       async addressCount() {
//         await delay(time)
//         return `2-${time}`
//       },
//     }
//   }
// };


const rootAst = {
  Country: {
    name: 'Country',
    type: 'Object',
    fields: {
      country_id: {
        name: 'country_id',
        type: 'number'
      }, country: {
        name: 'country',
        type: 'string'
      }, cityList: {
        name: 'cityList',
        type: 'array',
        elementType: 'City',
        nested: {
          level: 1, dependsOn: ['country_id']
        }
      }, cityCount: {
        name: 'cityCount',
        type: 'number',
        nested: {
          level: 1, dependsOn: ['country_id']
        }
      }, addressCount: {
        name: 'addressCount',
        type: 'number',
        nested: {level: 2, dependsOn: ['cityList', 'addressCount']}
      }
    }
  }, City: {
    name: 'City',
    type: 'Object',
    fields: {
      city_id: {
        name: 'city_id',
        type: 'number'
      }, country_id: {
        name: 'country_id',
        type: 'number'
      }, city: {
        name: 'city',
        type: 'string'
      }, addressList: {
        name: 'addressList',
        type: 'array',
        elementType: 'City'
      }, countryRead: {
        name: 'countryRead',
        type: 'Country'
      }, addressCount: {
        name: 'addressCount',
        type: 'number'
      }
    }
  }, Address: {
    name: 'Address',
    type: 'Object',
    fields: {
      address: {
        name: 'address',
        type: 'string'
      }
    }
  },
  CountryList: {
    type: 'array',
    elementType: 'Country'
  },
}


const nestResolver = {
  async Country() {
    return new Country(await knex('country').first())
  },

  async CountryList() {
    return (await knex('country').limit(10)).map(c => new Country(c))
  }
}


const req = {
  CountryList: {
    country: 1,
    cityList: {
      addressCount: 1
    },
    addressCount: 1,
  },
}


const reqExecutor = async (reqObj, resObj, _ast) => {

  const res = {}
  // const dependedFields = Object.keys(reqObj).map(k => (ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.dependsOn))
  /*  const dependFields = new Set();
    for(const k of Object.keys(reqObj)){
      if(ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.dependsOn){
        dependFields.add(ast.fields[k].nested.dependsOn)

      }
    }*/

  function extractDependsOn(key, i = 0, prev, __ast) {
    const ast = __ast || _ast
    if (!prev || typeof prev !== 'object' || i >= _ast.fields[key].nested.dependsOn.length) {
      if (typeof resObj[key] === 'function') {
        return resObj[key](prev)//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        return Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      } else {
        return Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      }
    }
    if (typeof prev[key] === 'function') {
      return resObj[key](res)//.call(res);
      // console.log(prefix + res[key])
    }


    if (!prev[_ast.fields[key].nested.dependsOn[i]])
      extractField(_ast.fields[key].nested.dependsOn[i], _ast)
    prev[key] = prev[_ast.fields[key].nested.dependsOn[i]].then(next => {
      // return extractDependsOn(key, ++i, next)


      if (Array.isArray(next)) {
        return Promise.all(next.map(r => extractDependsOn(key, ++i, r, rootAst[_ast[ast.fields[key].nested.dependsOn[i]].elementType])))
      } else {
        return extractDependsOn(reqObj[key], ++i, next, _ast[ast.fields[key].nested.dependsOn[i]])
      }

    })
    return prev[key]
  }


  function extractField(key, __ast) {
    const ast = __ast || _ast

    if (!(ast.fields && ast.fields[key] && ast.fields[key].nested)) {
      if (typeof resObj[key] === 'function') {
        res[key] = resObj[key]()//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        res[key] = Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      } else {
        res[key] = Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      }
    } else {
      extractDependsOn(key, 0, res)
    }


  }


  for (const key of Object.keys(reqObj)) {
    if (key in resObj) {
      extractField(key);
    }


    if (reqObj[key] && typeof reqObj[key] === 'object') {
      res[key] = res[key].then(res1 => {
        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => reqExecutor(reqObj[key], r, rootAst[_ast[key].elementType])))
        } else {
          return reqExecutor(reqObj[key], res1, _ast[key])
        }
      })
    }


  }

  await Promise.all(Object.values(res))

  const out = {};
  for (const [k, v] of Object.entries(res)) {
    out[k] = await v
  }


  return out
}

(async () => {
  console.time('start')
  console.log(JSON.stringify(await reqExecutor(req, nestResolver, rootAst), 0, 2));
  console.timeEnd('start')
})().catch(e => console.log(e)).finally(() => process.exit(0))


const reqExecutorOld = async (reqObj, resObj, ast) => {

  const res = {}


  await Promise.all(Object.keys(reqObj).map(async (key) => {
    if (key in resObj && !(ast.fields && ast.fields[key] && ast.fields[key].dependsOn)) {

      if (typeof resObj[key] === 'function') {
        res[key] = await resObj[key]()//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        res[key] = resObj[key]
        // console.log(prefix + res[key])
      } else {
        res[key] = resObj[key]
        // console.log(prefix + res[key])
      }
      await delay(100)
    }
    if (reqObj[key] && typeof reqObj[key] === 'object') {
      if (Array.isArray(res[key])) {
        res[key] = await Promise.all(res[key].map(r => reqExecutor(reqObj[key], r, rootAst[ast[key].elementType])))
      } else {
        res[key] = await reqExecutor(reqObj[key], res[key], ast[key])
      }
    }

  }))

  return res
}
