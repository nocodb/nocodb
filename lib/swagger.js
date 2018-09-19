'use strict';

class Swagger {

  constructor() {
    this.data = {
      "swagger": "2.0",
      "info": {
        "version": "0.1.0",
        "termsOfService": "https://github.com/o1lab/xmysql",
        "contact": {
          "name": "https://github.com/o1lab/xmysql"
        },
        "license": {
          "name": "MIT"
        }
      },
      "host": "localhost:3000",
      "basePath": "/api",
      "schemes": [
        "http"
      ],
      "consumes": [
        "application/json"
      ],
      "produces": [
        "application/json"
      ],
      "paths": {},
      "definitions": {
        "error": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "type": "string"
            },
            "tag": {
              "type": "string"
            }
          }
        }
      }
    }
  }

  title(databaseName) {
    this.data.info.title = "REST-API for Database " + databaseName;
    this.data.info.description = "An auto-generated REST API for Database " + databaseName;
  }

  addDefinition(resource) {
    this.data.paths["/" + resource.resource] = {};
    this.data.definitions[resource.resource] = {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "tag": {
          "type": "string"
        }
      }
    };
  }

  addGetAll(routes, i, resourceCtrl, j, resource) {
    this.data.paths["/" + resource.resource]["get"] = {
      "description": "Returns all " + resource.resource + " in the database, limited at 50 entries.",
      "operationId": "find" + resource.resource,
      "produces": [
        "application/json",
      ],
      "parameters": [
        {
          "name": "tags",
          "in": "query",
          "description": "tags to filter by",
          "required": false,
          "type": "array",
          "items": {
            "type": "string"
          },
          "collectionFormat": "csv"
        },
        {
          "name": "limit",
          "in": "query",
          "description": "maximum number of results to return",
          "required": false,
          "type": "integer",
          "format": "int32"
        }
      ],
      "responses": {
        "200": {
          "description": resource.resource + " response",
          "schema": {
            "type": "array",
            "items": {
              "$ref": "#/definitions/" + resource.resource,
            }
          }
        },
        "default": {
          "description": "unexpected error",
          "schema": {
            "$ref": "#/definitions/error"
          }
        }
      }
    }
  }

  addPostSingle(routes, i, resourceCtrl, j, resource) {
    this.data.paths["/" + resource.resource]["post"] = {
      "description": "Creates a new entity in " + resource.resource,
      "operationId": "add" + resource.resource,
      "produces": [
        "application/json"
      ],
      "parameters": [
        {
          "name": resource.resource + " entity",
          "in": "body",
          "description": resource.resource + " entity to add to the store",
          "required": true,
          "schema": {
            "$ref": "#/definitions/New" + resource.resource
          }
        }
      ],
      "responses": {
        "200": {
          "description": resource.resource + " entity response",
          "schema": {
            "$ref": "#/definitions/" + resource.resource
          }
        },
        "default": {
          "description": "unexpected error",
          "schema": {
            "$ref": "#/definitions/error"
          }
        }
      }
    }
  }

  getJson() {
    return this.data;
  }



}

//expose class
module.exports = Swagger;
