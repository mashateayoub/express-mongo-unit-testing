function httpMocks() {
  return {
    req: { params: {}, body: {}, method: 'GET', originalUrl: '/unknown' },
    res: { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() },
    next: jest.fn()
  };
}
module.exports = httpMocks;
