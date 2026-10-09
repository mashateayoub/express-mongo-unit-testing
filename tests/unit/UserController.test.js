const UserController = require('../../src/controllers/UserController');
const httpMocks = require('../helpers/httpMocks');

let service, controller, req, res, next;
beforeEach(() => {
  service = { getById: jest.fn(), create: jest.fn() };
  controller = new UserController(service);
  ({ req, res, next } = httpMocks());
});
test('répond 200 et conserve this lorsque la méthode est détachée', async () => {
  req.params.id = 'id';
  const user = { _id: 'id' };
  service.getById.mockResolvedValue(user);
  const handler = controller.getById;
  await handler(req, res, next);
  expect(service.getById).toHaveBeenCalledWith('id');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user } });
  expect(next).not.toHaveBeenCalled();
});
test('répond 201 avec l’utilisateur créé', async () => {
  req.body = { name: 'Sara', email: 'sara@example.com' };
  const user = { _id: 'id', ...req.body };
  service.create.mockResolvedValue(user);
  const handler = controller.create;
  await handler(req, res, next);
  expect(service.create).toHaveBeenCalledWith(req.body);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { user } });
  expect(next).not.toHaveBeenCalled();
});
test.each(['getById', 'create'])('transmet un rejet de %s sans répondre', async method => {
  const error = new Error('Incident service');
  service[method].mockRejectedValue(error);
  await controller[method](req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBe(error);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
