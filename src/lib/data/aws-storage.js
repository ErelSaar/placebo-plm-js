const BASE_URL = "http://localhost:5173/api";


// =========================
// RESPONSE HANDLER
// =========================

const handleResponse = async (response) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error || `Request failed with status ${response.status}`
        );
    }

    return data;
};


// =========================
// GENERIC TABLE REQUEST
// =========================

const tableRequest = async (
    table,
    command,
    id = null,
    body = null,
    filters = {}
) => {

    let method;
    let url = `${BASE_URL}/${table}`;

    switch (command) {

        case 'get':
            method = 'GET';

            if (id != null) {
                url += `/${id}`;
            } else {
                const params = new URLSearchParams();

                // =========================
                // ORDER FILTERS
                // =========================

                if (table === 'orders') {

                    if (filters.search) {
                        params.append(
                            'search',
                            filters.search
                        );
                    }

                    if (filters.status) {
                        params.append(
                            'status',
                            filters.status
                        );
                    }
                }


                // =========================
                // ORDER LINE FILTERS
                // =========================

                if (table === 'order_lines') {

                    if (filters.order_id) {
                        params.append(
                            'order_id',
                            filters.order_id
                        );
                    }

                    if (filters.product_id) {
                        params.append(
                            'product_id',
                            filters.product_id
                        );
                    }
                }


                // =========================
                // ADDITIONAL COST FILTERS
                // =========================

                if (table === 'order_additional_costs') {

                    if (filters.order_id) {
                        params.append(
                            'order_id',
                            filters.order_id
                        );
                    }
                }


                // =========================
                // PRODUCT FILTERS
                // =========================

                if (table === 'products') {

                    if (filters.name) {
                        params.append(
                            'name',
                            filters.name
                        );
                    }

                    if (filters.style_code) {
                        params.append(
                            'style_code',
                            filters.style_code
                        );
                    }

                    if (filters.sku) {
                        params.append(
                            'sku',
                            filters.sku
                        );
                    }

                    if (filters.category) {
                        params.append(
                            'category',
                            filters.category
                        );
                    }

                    if (filters.status) {
                        params.append(
                            'status',
                            filters.status
                        );
                    }
                }


                // =========================
                // MATERIAL FILTERS
                // =========================

                if (table === 'materials') {

                    if (filters.status) {
                        params.append(
                            'status',
                            filters.status
                        );
                    }

                    if (filters.search) {
                        params.append(
                            'search',
                            filters.search
                        );
                    }
                }


                // =========================
                // SUPPLIER FILTERS
                // =========================

                if (table === 'suppliers') {

                    if (filters.status) {
                        params.append(
                            'status',
                            filters.status
                        );
                    }

                    if (filters.search) {
                        params.append(
                            'search',
                            filters.search
                        );
                    }
                }


                // =========================
                // BOM LINE FILTERS
                // =========================

                if (table === 'bom_lines') {

                    if (filters.product_id) {
                        params.append(
                            'product_id',
                            filters.product_id
                        );
                    }

                    if (filters.material_id) {
                        params.append(
                            'material_id',
                            filters.material_id
                        );
                    }

                    if (filters.material) {
                        params.append(
                            'material',
                            filters.material
                        );
                    }

                    if (filters.supplier) {
                        params.append(
                            'supplier',
                            filters.supplier
                        );
                    }
                }


                // =========================
                // AUDIT LOG FILTERS
                // =========================

                if (table === 'audit_logs') {

                    if (filters.search) {
                        params.append(
                            'search',
                            filters.search
                        );
                    }

                    if (filters.user) {
                        params.append(
                            'user',
                            filters.user
                        );
                    }

                    if (filters.action) {
                        params.append(
                            'action',
                            filters.action
                        );
                    }

                    if (filters.entity_type) {
                        params.append(
                            'entity_type',
                            filters.entity_type
                        );
                    }

                    if (filters.dateFrom) {
                        params.append(
                            'dateFrom',
                            filters.dateFrom
                        );
                    }

                    if (filters.dateTo) {
                        params.append(
                            'dateTo',
                            filters.dateTo
                        );
                    }
                }

                const queryString = params.toString();

                if (queryString) {
                    url += `?${queryString}`;
                }
            }

            break;


        case 'add':
            method = 'POST';
            break;


        case 'update':
            method = 'PUT';

            if (id == null) {
                throw new Error(
                    `ID is required for ${table} update`
                );
            }

            url += `/${id}`;

            break;


        case 'delete':
            method = 'DELETE';

            if (id == null) {
                throw new Error(
                    `ID is required for ${table} delete`
                );
            }

            url += `/${id}`;

            break;


        default:
            throw new Error(
                `Unknown command: ${command}`
            );
    }


    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };


    if (
        body !== null &&
        method !== 'GET'
    ) {
        options.body = JSON.stringify(body);
    }


    return await handleResponse(
        await fetch(url, options)
    );
};


// =========================
// ORDER
// =========================

const getOrder = async (orderId) => {

    if (orderId == null) {
        throw new Error('Order ID is required');
    }

    const order = await tableRequest(
        'orders',
        'get',
        orderId
    );

    const lines = await tableRequest(
        'order_lines',
        'get',
        null,
        null,
        {
            order_id: orderId
        }
    );

    const additionalCosts = await tableRequest(
        'order_additional_costs',
        'get',
        null,
        null,
        {
            order_id: orderId
        }
    );

    return {
        ...order,
        lines,
        additional_costs: additionalCosts
    };
};


// =========================
// UPDATE ORDER
// =========================

const updateOrder = async (orderId, data) => {

    if (orderId == null) {
        throw new Error('Order ID is required');
    }

    const {
        lines,
        additional_costs,
        ...orderData
    } = data;


    // =========================
    // UPDATE ORDER
    // =========================

    await tableRequest(
        'orders',
        'update',
        orderId,
        orderData
    );


    // =========================
    // UPDATE ORDER LINES
    // =========================

    if (lines !== undefined) {

        const existingLines = await tableRequest(
            'order_lines',
            'get',
            null,
            null,
            {
                order_id: orderId
            }
        );

        const existingIds = new Set(
            existingLines.map(
                line => line.id
            )
        );

        const receivedIds = new Set(
            lines
                .filter(
                    line => line.id != null
                )
                .map(
                    line => line.id
                )
        );


        // Delete removed lines

        for (const line of existingLines) {

            if (!receivedIds.has(line.id)) {

                await tableRequest(
                    'order_lines',
                    'delete',
                    line.id
                );
            }
        }


        // Add / update lines

        for (const line of lines) {

            if (existingIds.has(line.id)) {

                await tableRequest(
                    'order_lines',
                    'update',
                    line.id,
                    line
                );

            } else {

                await tableRequest(
                    'order_lines',
                    'add',
                    null,
                    {
                        ...line,
                        order_id: orderId
                    }
                );
            }
        }
    }


    // =========================
    // UPDATE ADDITIONAL COSTS
    // =========================

    if (additional_costs !== undefined) {

        const existingCosts = await tableRequest(
            'order_additional_costs',
            'get',
            null,
            null,
            {
                order_id: orderId
            }
        );

        const existingIds = new Set(
            existingCosts.map(
                cost => cost.id
            )
        );

        const receivedIds = new Set(
            additional_costs
                .filter(
                    cost => cost.id != null
                )
                .map(
                    cost => cost.id
                )
        );


        // Delete removed costs

        for (const cost of existingCosts) {

            if (!receivedIds.has(cost.id)) {

                await tableRequest(
                    'order_additional_costs',
                    'delete',
                    cost.id
                );
            }
        }


        // Add / update costs

        for (const cost of additional_costs) {

            if (existingIds.has(cost.id)) {

                await tableRequest(
                    'order_additional_costs',
                    'update',
                    cost.id,
                    cost
                );

            } else {

                await tableRequest(
                    'order_additional_costs',
                    'add',
                    null,
                    {
                        ...cost,
                        order_id: orderId
                    }
                );
            }
        }
    }


    return await getOrder(orderId);
};


// =========================
// MATERIAL
// =========================

const getMaterial = async (materialId) => {

    if (materialId == null) {
        throw new Error('Material ID is required');
    }

    const material = await tableRequest(
        'materials',
        'get',
        materialId
    );

    const bomLines = await tableRequest(
        'bom_lines',
        'get',
        null,
        null,
        {
            material_id: materialId
        }
    );

    return {
        ...material,
        bom_lines: bomLines
    };
};


// =========================
// UPDATE MATERIAL
// =========================

const updateMaterial = async (
    materialId,
    data
) => {

    if (materialId == null) {
        throw new Error('Material ID is required');
    }

    const {
        bom_lines,
        ...materialData
    } = data;


    await tableRequest(
        'materials',
        'update',
        materialId,
        materialData
    );


    if (bom_lines !== undefined) {

        const existingLines = await tableRequest(
            'bom_lines',
            'get',
            null,
            null,
            {
                material_id: materialId
            }
        );

        const existingIds = new Set(
            existingLines.map(
                line => line.id
            )
        );

        const receivedIds = new Set(
            bom_lines
                .filter(
                    line => line.id != null
                )
                .map(
                    line => line.id
                )
        );


        // Delete removed BOM lines

        for (const line of existingLines) {

            if (!receivedIds.has(line.id)) {

                await tableRequest(
                    'bom_lines',
                    'delete',
                    line.id
                );
            }
        }


        // Add / update BOM lines

        for (const line of bom_lines) {

            if (existingIds.has(line.id)) {

                await tableRequest(
                    'bom_lines',
                    'update',
                    line.id,
                    line
                );

            } else {

                await tableRequest(
                    'bom_lines',
                    'add',
                    null,
                    {
                        ...line,
                        material_id: materialId
                    }
                );
            }
        }
    }


    return await getMaterial(materialId);
};


// =========================
// MAIN API REQUEST
// =========================

export const apiRequest = async (
    dataType,
    command,
    id = null,
    body = null,
    filters = {}
) => {

    // =========================
    // ORDER SPECIAL HANDLING
    // =========================

    if (
        dataType === 'orders' &&
        command === 'get' &&
        id != null
    ) {
        return await getOrder(id);
    }


    if (
        dataType === 'orders' &&
        command === 'update'
    ) {
        return await updateOrder(
            id,
            body
        );
    }


    // =========================
    // MATERIAL SPECIAL HANDLING
    // =========================

    if (
        dataType === 'materials' &&
        command === 'get' &&
        id != null
    ) {
        return await getMaterial(id);
    }


    if (
        dataType === 'materials' &&
        command === 'update'
    ) {
        return await updateMaterial(
            id,
            body
        );
    }


    // =========================
    // ALL OTHER TABLES
    // =========================

    return await tableRequest(
        dataType,
        command,
        id,
        body,
        filters
    );
};