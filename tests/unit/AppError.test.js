const AppError = require('../../src/errors/AppError');

test.each([[400, 'fail'], [404, 'fail'], [500, 'error']])(
  'construit une erreur %i avec le statut %s', (code, status) => {
    const error = new AppError('Message métier', code);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Message métier');
    expect(error.statusCode).toBe(code);
    expect(error.status).toBe(status);
    expect(error.isOperational).toBe(true);
    expect(error.stack).toContain('Message métier');
  }
);
test('utilise 500 par défaut', () => {
  expect(new AppError('Erreur').statusCode).toBe(500);
});
