jest.mock('../../src/routes/userRoutes', () => jest.fn());
const express = require('express');
const createApp = require('../../src/app');
const createUserRoutes = require('../../src/routes/userRoutes');
const notFound = require('../../src/middlewares/notFound');
const errorHandler = require('../../src/middlewares/errorHandler');

test('monte JSON, les routes, la 404 et les erreurs dans cet ordre', () => {
  const app = { use: jest.fn(), get: jest.fn() };
  const parser = jest.fn();
  const router = jest.fn();
  const factory = jest.fn().mockReturnValue(app);
  factory.json = jest.fn().mockReturnValue(parser);
  const controller = {};
  createUserRoutes.mockReturnValue(router);
  expect(createApp(controller, factory)).toBe(app);
  expect(factory.json).toHaveBeenCalledWith({ limit: '10kb' });
  expect(createUserRoutes).toHaveBeenCalledWith(controller);
  expect(app.use.mock.calls).toEqual([[parser], ['/api/users', router], [notFound], [errorHandler]]);
  expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function));
  const health = app.get.mock.calls[0][1];
  const res = { json: jest.fn() };
  health({}, res);
  expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
});
test('crée une application Express par défaut sans écouter un port', () => {
  createUserRoutes.mockReturnValue(express.Router());
  expect(typeof createApp({})).toBe('function');
});
