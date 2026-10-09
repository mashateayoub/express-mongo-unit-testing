const { EventEmitter } = require('node:events');
const { listenHttp, closeHttp } = require('../../src/httpServer');

test('résout seulement après l’événement listening', async () => {
  const server = new EventEmitter();
  const app = { listen: jest.fn().mockReturnValue(server) };
  const pending = listenHttp(app, 3000);
  expect(app.listen).toHaveBeenCalledWith(3000);
  server.emit('listening');
  await expect(pending).resolves.toBe(server);
  expect(server.listenerCount('error')).toBe(0);
});
test('rejette une erreur d’écoute et retire le listener listening', async () => {
  const server = new EventEmitter();
  const error = new Error('Port occupé');
  const pending = listenHttp({ listen: jest.fn().mockReturnValue(server) }, 3000);
  server.emit('error', error);
  await expect(pending).rejects.toBe(error);
  expect(server.listenerCount('listening')).toBe(0);
});
test('propage une exception immédiate de listen', async () => {
  const error = new Error('Impossible');
  await expect(listenHttp({ listen() { throw error; } }, 3000)).rejects.toBe(error);
});
test('attend la fermeture HTTP', async () => {
  const server = { close: jest.fn(callback => callback()) };
  await closeHttp(server);
  expect(server.close).toHaveBeenCalledTimes(1);
});
test('propage une erreur de fermeture', async () => {
  const error = new Error('Fermeture impossible');
  await expect(closeHttp({ close: callback => callback(error) })).rejects.toBe(error);
});
