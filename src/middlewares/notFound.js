const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  return next(new AppError(`Route introuvable : ${req.method} ${req.originalUrl}`, 404));
}
module.exports = notFound;
