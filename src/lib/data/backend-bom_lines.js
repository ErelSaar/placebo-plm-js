import { apiRequest } from './aws-storage.js';

export const bomLineRepository = {
    async getAll() {
        return await apiRequest('bom_lines', 'get');
    },

    async getByProduct(productId) {
        return await apiRequest(
            'bom_lines',
            'get',
            null,
            null,
            { product_id: productId }
        );
    },

    async getById(id) {
        return await apiRequest('bom_lines', 'get', id);
    },

    async create(data) {
        return await apiRequest(
            'bom_lines',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'bom_lines',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'bom_lines',
            'delete',
            id
        );
    }
};