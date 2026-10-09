const AppError = require('../../src/errors/AppError');
const notFound = require('../../src/middlewares/notFound');
const httpMocks = require('../helpers/httpMocks');

test('transmet une AppError 404 contenant méthode et URL', () => {
  const { req, res, next } = httpMocks();
  notFound(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  const error = next.mock.calls[0][0];
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('Route introuvable : GET /unknown');
  expect(res.json).not.toHaveBeenCalled();
});
