import { apiRequest } from './aws-storage.js';

export const attachmentRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'attachments',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'attachments',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'attachments',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'attachments',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'attachments',
            'delete',
            id
        );
    }
};