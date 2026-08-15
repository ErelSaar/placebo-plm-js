import { apiRequest } from './aws-storage.js';

export const userRepository = {

    async getAll() {
        return await apiRequest('users', 'get');
    },

    async getById(id) {
        return await apiRequest('users', 'get', id);
    },

    async create(data) {
        return await apiRequest('users', 'add', null, data);
    },

    async update(id, data) {
        return await apiRequest('users', 'update', id, data);
    },

    async delete(id) {
        return await apiRequest('users', 'delete', id);
    },

    async login(username, password) {
        return await apiRequest(
            'users/login',
            'add',
            null,
            {
                username,
                password
            }
        );
    }
};