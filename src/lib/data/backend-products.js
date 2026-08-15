import { apiRequest } from './aws-storage.js';

export const productRepository2 = {
    async getAll() {
        return await apiRequest('products', 'get');
    },

    async getById(id) {
        return await apiRequest('products', 'get', id);
    },

    async create(data) {
        return await apiRequest('products', 'add', null, data);
    },

    async update(id, data) {
        return await apiRequest('products', 'update', id, data);
    },

    async delete(id) {
        return await apiRequest('products', 'delete', id);
    }
};