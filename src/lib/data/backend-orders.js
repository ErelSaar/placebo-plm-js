import { apiRequest } from './aws-storage.js';


// =========================
// ORDER
// =========================

export const orderRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'orders',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'orders',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'orders',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'orders',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'orders',
            'delete',
            id
        );
    },

    async softDelete(id) {
        return await apiRequest(
            'orders',
            'soft_delete',
            id
        );
    }
};


// =========================
// ORDER LINES
// =========================

export const orderLineRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'order_lines',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'order_lines',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'order_lines',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'order_lines',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'order_lines',
            'delete',
            id
        );
    },

    async softDelete(id) {
        return await apiRequest(
            'order_lines',
            'soft_delete',
            id
        );
    },

    async getByOrderId(orderId) {
        return await apiRequest(
            'order_lines',
            'get',
            null,
            null,
            {
                order_id: orderId
            }
        );
    }
};


// =========================
// ORDER ADDITIONAL COSTS
// =========================

export const orderAdditionalCostRepository = {

    async getAll(filters = {}) {
        return await apiRequest(
            'order_additional_costs',
            'get',
            null,
            null,
            filters
        );
    },

    async getById(id) {
        return await apiRequest(
            'order_additional_costs',
            'get',
            id
        );
    },

    async create(data) {
        return await apiRequest(
            'order_additional_costs',
            'add',
            null,
            data
        );
    },

    async update(id, data) {
        return await apiRequest(
            'order_additional_costs',
            'update',
            id,
            data
        );
    },

    async delete(id) {
        return await apiRequest(
            'order_additional_costs',
            'delete',
            id
        );
    },

    async softDelete(id) {
        return await apiRequest(
            'order_additional_costs',
            'soft_delete',
            id
        );
    },

    async getByOrderId(orderId) {
        return await apiRequest(
            'order_additional_costs',
            'get',
            null,
            null,
            {
                order_id: orderId
            }
        );
    }
};