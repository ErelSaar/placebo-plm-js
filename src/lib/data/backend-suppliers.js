import { apiRequest } from './aws-storage.js';

export const supplierRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'suppliers',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'suppliers',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'suppliers',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'suppliers',
            'update',
            id,
            data
        );
    },

    async softDelete(id) {
        const supplier = await this.getById(id);

        return await this.update(id, {
            ...supplier,
            spam: true
        });
    },

    async delete(id) {
        return await apiRequest(
            'suppliers',
            'delete',
            id
        );
    }
};