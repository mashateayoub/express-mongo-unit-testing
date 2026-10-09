class UserController {
  constructor(service) {
    this.service = service;
    // Express appelle ces méthodes comme des callbacks : préserver this.
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
  }

  async getById(req, res, next) {
    try {
      const user = await this.service.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = await this.service.create(req.body);
      return res.status(201).json({ status: 'success', data: { user } });
    } catch (error) {
      return next(error);
    }
  }
}
module.exports = UserController;
