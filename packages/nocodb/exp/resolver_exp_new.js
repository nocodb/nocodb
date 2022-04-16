const {expect} = require('chai');
require('mocha');
const knex = require('knex')({
  client: 'mysql2',
  connection: { "user": "root",
    "password": "password",
    "port":"3306",
    "host":"localhost",
    database: 'sakila'
  }
});
const delay = t => new Promise(res => setTimeout(() => res(), t))

const simpleInOut = require('./testData/01_simple')
const compareObj = require('./compareObj')
const Dataloader = require("dataloader");

const groupBy = (arr, field) => {
  return (arr || []).reduce((obj, o) => {
    obj[o[field]] = obj[o[field]] || []
    obj[o[field]].push(o)
    return obj;
  }, {})
}


const cityListLoader = new Dataloader(async function (ids) {
  const cities = await knex('city').select('*').whereIn('country_id', ids);
  const gbObj = groupBy(cities, 'country_id')
  return ids.map(id => (gbObj[id] || []).map(c => new City(c)))
})


const addressCountLoader = new Dataloader(async function (ids) {
  const cities = await knex('address').select('city_id').count('address_id as count')
    .groupBy('city_id')
    .whereIn('city_id', ids);
  const gbObj = groupBy(cities, 'city_id')
  return ids.map(id => (gbObj[id] && gbObj[id][0] && gbObj[id][0].count))
})
const cityCountLoader = new Dataloader(async function (ids) {
  const cities = await knex('city').select('country').count('city_id as count')
    .groupBy('country_id')
    .whereIn('country_id', ids);
  const gbObj = groupBy(cities, 'country_id')
  return ids.map(id => (gbObj[id] && gbObj[id][0] && gbObj[id][0].count))
})

const addressListLoader = new Dataloader(async function (ids) {
  const addresses = await knex('address').select('*').whereIn('city_id', ids);
  const gbObj = groupBy(addresses, 'city_id')
  return ids.map(id => (gbObj[id] || []).map(c => new Address(c)))
})

const cityLoader = new Dataloader(async function (ids) {
  const cities = await knex('city').select('*').whereIn('city_id', ids);
  const gbObj = groupBy(cities, 'city_id')
  return ids.map(id => gbObj[id] && gbObj[id][0] ? new City(gbObj[id][0]) : null)
})
const countryLoader = new Dataloader(async function (ids) {
  const countries = await knex('country').select('*').whereIn('country_id', ids);
  const gbObj = groupBy(countries, 'country_id')
  return ids.map(id => gbObj[id] && gbObj[id][0] ? new Country(gbObj[id][0]) : null)
})

class Country {
  constructor(data) {
    Object.assign(this, data)
  }

  async cityList() {
    return await cityListLoader.load(this.country_id)
  }

  async cityCount() {
    return cityCountLoader.load(this.country_id)
  }

}


class Address {
  constructor(data) {
    Object.assign(this, data)
  }

  async City() {
    return cityLoader.load(this.city_id)
  }


}

class City {
  constructor(data) {
    Object.assign(this, data)
  }

  async Country() {
    return countryLoader.load(this.country_id)
  }

  async addressList() {
    return addressListLoader.load(this.city_id)
  }

  async addressCount() {
    return addressCountLoader.load(this.city_id)
  }


}

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
      },

      cityList: {
        name: 'cityList',
        type: 'array',
        elementType: 'City',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },
      cityCount: {
        name: 'cityCount',
        type: 'number',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },


      addressCount: {
        name: 'addressCount',
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressCount']}
      },
      addressList: {
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressList', 'address']}
      },
      d: {
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressList', 'City', 'Country']}
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
        elementType: 'Address'
      }, countryRead: {
        name: 'countryRead',
        type: 'Country'
      }, addressCount: {
        name: 'addressCount',
        type: 'number'
      },
      Country: {
        name: 'Country',
        type: 'Country',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },
    }
  }, Address: {
    name: 'Address',
    type: 'Object',
    fields: {
      address: {
        name: 'address',
        type: 'string'
      },
      City: {
        name: 'City',
        type: 'City',
        // nested: {
        //   level: 1,
        //   path: ['city_id']
        // }
      },
      CountryName: {
        name: 'Country',
        type: 'Country',
        nested: {
          level: 1,
          path: ['City', 'Country', 'country']
        }
      }
    }
  },
  CountryList: {
    type: 'array',
    elementType: 'Country'
  },
  AddressList: {
    type: 'array',
    elementType: 'Address'
  },
}


const nestResolver = {
  async Country() {
    return new Country(await knex('country').first())
  },

  async CountryList() {
    return (await knex('country').limit(2)).map(c => new Country(c))
  },

  async AddressList() {
    return (await knex('address').limit(10)).map(c => new Address(c))
  }
}

const flattenArray = (res) => {
  return Array.isArray(res) ? res.flatMap(r => flattenArray(r)) : res
}


const execute = async (requestObj, resolverObj, ast, objTree = {}) => {

  const res = []
  // extract nested(lookup) recursively
  const extractNested = (path, o = {}, resolver) => {
    if (path.length) {
      const key = path[0]
      if (!o[key]) {


        if (typeof resolver[key] === 'function') {
          o[path[0]] = resolver[key]()//.call(res);
          // console.log(prefix + o[path[0]])
        } else if (typeof resolver[key] === 'object') {
          o[path[0]] = Promise.resolve(resolver[key])
          // console.log(prefix + o[path[0]])
        } else {
          o[path[0]] = Promise.resolve(resolver[key])
          // console.log(prefix + o[path[0]])
        }


      } else if (typeof o[key] === 'function') {
        o[key] = o[key]()
      }


      return (o[path[0]] instanceof Promise ? o[path[0]] : Promise.resolve(o[path[0]])).then(res1 => {

        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => extractNested(path.slice(1), r)))
        } else {
          return extractNested(path.slice(1), res1)
        }

      })
    } else {
      return Promise.resolve(o)
    }
  };


  // function for extracting field
  function extractField(key) {
    if (!(ast && ast && ast[key] && ast[key].nested)) {
      if (resolverObj) {
        // resolve if it's resolver function
        if (typeof resolverObj[key] === 'function') {
          res[key] = resolverObj[key]()//.call(res);
          // console.log(prefix + res[key])
        } else if (typeof resolverObj[key] === 'object') {
          res[key] = Promise.resolve(resolverObj[key])
          // console.log(prefix + res[key])
        } else {
          res[key] = Promise.resolve(resolverObj[key])
          // console.log(prefix + res[key])
        }
      }

      objTree[key] = res[key]

    } else {

      // if nested extract the nested value
      res[key] = extractNested(ast[key].nested.path, objTree, resolverObj).then(res => {
        return Promise.resolve(flattenArray(res))
      })


    }


  }


  for (const key of Object.keys(requestObj)) {
    extractField(key);

    if (requestObj[key] && typeof requestObj[key] === 'object') {
      res[key] = res[key].then(res1 => {
        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => execute(requestObj[key], r, rootAst[ast[key].elementType] && rootAst[ast[key].elementType].fields, objTree[key] = {})))
        } else {
          return execute(requestObj[key], res1, ast[key].fields, objTree[key] = {})
        }
      })
    }


  }

  await Promise.all(Object.values(res))

  const out = {};
  for (const [k, v] of Object.entries(res)) {
    if (k in requestObj)
      out[k] = await v
  }


  return out
}

describe('Resolver', async () => {
  for (const {name, in: input, out} of simpleInOut) {
    it(`Resolver : ${name}`, async function () {
      this.timeout(50000)
      console.time(name)
      const res = await execute(input, nestResolver, rootAst);
      console.timeEnd(name)
      console.log(JSON.stringify(res, 0, 2))
      expect(compareObj(out, res)).to.be.eq(true)
    });
  }
})





