

function extractDBError(_error:Error) {
   // if (error instanceof knex.DBError) { switch (error.code) { case 'ER_NO_SUCH_TABLE': console.error('Table does not exist'); break; case 'ER_BAD_FIELD_ERROR': console.error('Invalid column name'); break; // Add more cases for other common errors here default: console.error('Unknown error:', error); break; } } else { console.error('Unexpected error:', error); } }).finally(() => { knex.destroy(); // Close the database connection });
}

export default function (
  requestHandler: (req: any, res: any, next?: any) => any
) {
  return async function (req: any, res: any, next: any) {
    try {
      return await requestHandler(req, res, next);
    } catch (e) {

      extractDBError(e)


      // todo: error log
      console.log(requestHandler.name ? `${requestHandler.name} ::` : '', e);

      if (e instanceof BadRequest) {
        return res.status(400).json({ msg: e.message });
      } else if (e instanceof Unauthorized) {
        return res.status(401).json({ msg: e.message });
      } else if (e instanceof Forbidden) {
        return res.status(403).json({ msg: e.message });
      } else if (e instanceof NotFound) {
        return res.status(404).json({ msg: e.message });
      } else if (e instanceof InternalServerError) {
        return res.status(500).json({ msg: e.message });
      } else if (e instanceof NotImplemented) {
        return res.status(501).json({ msg: e.message });
      }
      next(e);
    }
  };
}

class BadRequest extends Error {}
class Unauthorized extends Error {}
class Forbidden extends Error {}
class NotFound extends Error {}
class InternalServerError extends Error {}
class NotImplemented extends Error {}

export class NcError {
  static notFound(message = 'Not found') {
    throw new NotFound(message);
  }
  static badRequest(message) {
    throw new BadRequest(message);
  }
  static unauthorized(message) {
    throw new Unauthorized(message);
  }
  static forbidden(message) {
    throw new Forbidden(message);
  }
  static internalServerError(message = 'Internal server error') {
    throw new InternalServerError(message);
  }
  static notImplemented(message = 'Not implemented') {
    throw new NotImplemented(message);
  }
}
