import { apiRequest } from './aws-storage.js';

export const auditRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'audit_logs',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'audit_logs',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'audit_logs',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'audit_logs',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'audit_logs',
            'delete',
            id
        );
    }
};