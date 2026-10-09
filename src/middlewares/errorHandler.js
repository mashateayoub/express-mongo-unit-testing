const AppError = require('../errors/AppError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
 
  // express.json() signale ainsi les corps JSON mal formés.
  const invalidJson = error.type === 'entity.parse.failed';
  const expected = error instanceof AppError || invalidJson;
  const statusCode = invalidJson ? 400 : expected ? error.statusCode : 500;
  const production = process.env.NODE_ENV === 'production';
  const message = invalidJson ? 'JSON invalide'
    : production && !expected ? 'Erreur interne du serveur' : error.message;

  if (!expected) console.error(error);
  const body = { status: statusCode < 500 ? 'fail' : 'error', message };
  if (!production) body.stack = error.stack;
  return res.status(statusCode).json(body);
}
module.exports = errorHandler;
