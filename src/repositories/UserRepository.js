const User = require('../models/User');

class UserRepository {
  constructor(model = User) {
    this.model = model;
  }

  async findById(id) {
    return this.model.findById(id).lean().exec();
  }

  async findByEmail(email) {
    return this.model.findOne({ email }).lean().exec();
  }

  async create(data) {
    const document = await this.model.create(data);
    return document.toObject();
  }
}
module.exports = UserRepository;
