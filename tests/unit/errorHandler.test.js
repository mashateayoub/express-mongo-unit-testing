const AppError = require('../../src/errors/AppError');
const errorHandler = require('../../src/middlewares/errorHandler');
const httpMocks = require('../helpers/httpMocks');

let req, res, next;
const originalEnv = process.env.NODE_ENV;
beforeEach(() => {
  ({ req, res, next } = httpMocks());
  process.env.NODE_ENV = 'development';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});
test('garde quatre paramètres', () => expect(errorHandler).toHaveLength(4));
test('expose la stack en développement', () => {
  const error = new AppError('Champ invalide', 400);
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: error.message, stack: error.stack });
  expect(next).not.toHaveBeenCalled();
});
test('préserve une erreur métier en production sans stack', () => {
  process.env.NODE_ENV = 'production';
  errorHandler(new AppError('Absent', 404), req, res, next);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Absent' });
  expect(console.error).not.toHaveBeenCalled();
});
test('masque et journalise un incident en production', () => {
  process.env.NODE_ENV = 'production';
  const error = new Error('password=secret-fictif');
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Erreur interne du serveur' });
  expect(console.error).toHaveBeenCalledWith(error);
  expect(next).not.toHaveBeenCalled();
});
test('expose un incident en développement', () => {
  const error = new Error('Incident');
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Incident', stack: error.stack });
});
test('convertit un JSON mal formé en 400', () => {
  process.env.NODE_ENV = 'production';
  errorHandler(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }), req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'JSON invalide' });
});
test('délègue sans écrire après envoi des en-têtes', () => {
  res.headersSent = true;
  const error = new Error('Trop tard');
  errorHandler(error, req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBe(error);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
