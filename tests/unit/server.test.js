const createRuntime = require('../../src/server');
const UserController = require('../../src/controllers/UserController');
const UserService = require('../../src/services/UserService');
const UserRepository = require('../../src/repositories/UserRepository');

let database, model, app, appFactory, listen, close, runtime, server;
beforeEach(() => {
  database = { connect: jest.fn().mockResolvedValue(), disconnect: jest.fn().mockResolvedValue() };
  model = { init: jest.fn().mockResolvedValue() };
  app = {};
  server = {};
  appFactory = jest.fn().mockReturnValue(app);
  listen = jest.fn().mockResolvedValue(server);
  close = jest.fn().mockResolvedValue();
  runtime = createRuntime({ database, model, appFactory, listen, close });
});
test('compose repository, service et contrôleur avec leurs dépendances', () => {
  const controller = appFactory.mock.calls[0][0];
  expect(controller).toBeInstanceOf(UserController);
  expect(controller.service).toBeInstanceOf(UserService);
  expect(controller.service.repository).toBeInstanceOf(UserRepository);
});
test('se connecte avant d’écouter le port', async () => {
  let finishConnection;
  database.connect.mockReturnValue(new Promise(resolve => { finishConnection = resolve; }));
  const pending = runtime.start({ uri: 'mongodb://demo', port: 3000 });
  expect(database.connect).toHaveBeenCalledWith('mongodb://demo');
  expect(listen).not.toHaveBeenCalled();
  finishConnection();
  await expect(pending).resolves.toBe(server);
  expect(listen).toHaveBeenCalledWith(app, 3000);
});
test.each([-1, 65536, 1.5, NaN])('refuse un port invalide : %p', async port => {
  await expect(runtime.start({ uri: 'mongodb://demo', port })).rejects.toThrow('PORT invalide');
  expect(database.connect).not.toHaveBeenCalled();
});
test('n’écoute pas si MongoDB est indisponible', async () => {
  const error = new Error('Mongo absent');
  database.connect.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(listen).not.toHaveBeenCalled();
});
test('déconnecte MongoDB si l’écoute HTTP échoue', async () => {
  const error = new Error('Port occupé');
  listen.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('préserve l’erreur d’écoute si le nettoyage échoue aussi', async () => {
  const error = new Error('Port occupé');
  const cleanup = new Error('Déconnexion impossible');
  listen.mockRejectedValue(error);
  database.disconnect.mockRejectedValue(cleanup);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(log).toHaveBeenCalledWith(cleanup);
});
test('ferme HTTP avant de déconnecter MongoDB', async () => {
  await runtime.start({ uri: 'mongodb://demo', port: 3000 });
  await runtime.stop();
  expect(close).toHaveBeenCalledWith(server);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(close.mock.invocationCallOrder[0]).toBeLessThan(database.disconnect.mock.invocationCallOrder[0]);
});
test('déconnecte même si HTTP ne se ferme pas correctement', async () => {
  await runtime.start({ uri: 'mongodb://demo', port: 3000 });
  const error = new Error('Close impossible');
  close.mockRejectedValue(error);
  await expect(runtime.stop()).rejects.toBe(error);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('permet de nettoyer un runtime sans serveur actif', async () => {
  await runtime.stop();
  expect(close).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
test('compose les dépendances réelles par défaut sans connexion ni port', () => {
  expect(createRuntime()).toEqual({ start: expect.any(Function), stop: expect.any(Function) });
});

test('n’écoute pas si l’initialisation des index échoue', async () => {
  const error = new Error('Index impossible');
  model.init.mockRejectedValue(error);
  await expect(runtime.start({ uri: 'mongodb://demo', port: 3000 })).rejects.toBe(error);
  expect(listen).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
