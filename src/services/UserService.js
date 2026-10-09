const AppError = require('../errors/AppError');

class UserService {
  constructor(repository) {
    this.repository = repository;
  }

  async getById(id) {
    if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new AppError('Identifiant MongoDB invalide', 400);
    }
    const user = await this.repository.findById(id);
    if (!user) throw new AppError('Utilisateur introuvable', 404);
    return user;
  }

  async create(data) {
    if (!data || typeof data.name !== 'string' || data.name.trim().length < 2) {
      throw new AppError('Le nom doit contenir au moins 2 caractères', 400);
    }
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new AppError('Email invalide', 400);
    }

    const payload = { name: data.name.trim(), email: data.email.trim().toLowerCase() };
    if (await this.repository.findByEmail(payload.email)) {
      throw new AppError('Email déjà utilisé', 409);
    }

    try {
      return await this.repository.create(payload);
    } catch (error) {
      // L'index MongoDB reste la garantie d'unicité en cas de requêtes concurrentes.
      if (error.code === 11000) throw new AppError('Email déjà utilisé', 409);
      throw error;
    }
  }
}
module.exports = UserService;
