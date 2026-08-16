import { apiRequest } from './aws-storage.js';

export const materialRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'materials',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'materials',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'materials',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'materials',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'materials',
            'delete',
            id
        );
    }
};