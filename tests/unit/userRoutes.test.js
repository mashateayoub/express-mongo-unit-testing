const createUserRoutes = require('../../src/routes/userRoutes');

test('enregistre les routes avec les callbacks du contrôleur', () => {
  const controller = { getById: jest.fn(), create: jest.fn() };
  const router = { get: jest.fn(), post: jest.fn() };
  expect(createUserRoutes(controller, router)).toBe(router);
  expect(router.get).toHaveBeenCalledTimes(1);
  expect(router.get).toHaveBeenCalledWith('/:id', controller.getById);
  expect(router.post).toHaveBeenCalledTimes(1);
  expect(router.post).toHaveBeenCalledWith('/', controller.create);
});
test('crée un vrai Router Express par défaut sans serveur', () => {
  const router = createUserRoutes({ getById: jest.fn(), create: jest.fn() });
  expect(typeof router).toBe('function');
});
