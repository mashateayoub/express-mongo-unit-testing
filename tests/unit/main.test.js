jest.mock('../../src/server', () => jest.fn());
const createRuntime = require('../../src/server');
const main = require('../../src/main');

let runtime, processRef, logger;
beforeEach(() => {
  runtime = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue() };
  processRef = { once: jest.fn(), exitCode: undefined };
  logger = { log: jest.fn(), error: jest.fn() };
});
test('démarre avec l’environnement et enregistre les signaux', async () => {
  await expect(main({ runtime, processRef, logger, env: { MONGO_URI: 'mongodb://demo', PORT: '4000' } }))
    .resolves.toBe(runtime);
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 4000 });
  expect(processRef.once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  expect(processRef.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  expect(logger.log).toHaveBeenCalledWith('API démarrée');
});
test('utilise le port 3000 en l’absence de PORT', async () => {
  await main({ runtime, processRef, logger, env: { MONGO_URI: 'mongodb://demo' } });
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 3000 });
});
test('signale un échec de démarrage sans installer les signaux', async () => {
  const error = new Error('Mongo absent');
  runtime.start.mockRejectedValue(error);
  await expect(main({ runtime, processRef, logger, env: {} })).resolves.toBeNull();
  expect(processRef.exitCode).toBe(1);
  expect(logger.error).toHaveBeenCalledWith('Démarrage impossible', error);
  expect(processRef.once).not.toHaveBeenCalled();
});
test('arrête une seule fois même si les deux signaux sont déclenchés', async () => {
  await main({ runtime, processRef, logger, env: {} });
  const sigint = processRef.once.mock.calls[0][1];
  const sigterm = processRef.once.mock.calls[1][1];
  await sigint();
  await sigterm();
  expect(runtime.stop).toHaveBeenCalledTimes(1);
});
test('signale un échec d’arrêt', async () => {
  await main({ runtime, processRef, logger, env: {} });
  const error = new Error('Stop impossible');
  runtime.stop.mockRejectedValue(error);
  await processRef.once.mock.calls[0][1]();
  expect(logger.error).toHaveBeenCalledWith('Arrêt impossible', error);
  expect(processRef.exitCode).toBe(1);
});

test('utilise les dépendances par défaut sans démarrer de serveur réel', async () => {
  createRuntime.mockReturnValue(runtime);
  jest.replaceProperty(process, 'env', {
    ...process.env, MONGO_URI: 'mongodb://demo', PORT: '3001'
  });
  const once = jest.spyOn(process, 'once').mockReturnValue(process);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  await expect(main()).resolves.toBe(runtime);
  expect(runtime.start).toHaveBeenCalledWith({ uri: 'mongodb://demo', port: 3001 });
  expect(once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  expect(log).toHaveBeenCalledWith('API démarrée');
});
