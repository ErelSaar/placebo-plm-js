// import { BASE_URL } from './config.js';
const BASE_URL = "http://localhost:5173/api"

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
// ORDER
// =========================

const getOrder = async (orderId) => {
    // Get the main order
    const orderResponse = await fetch(
        `${BASE_URL}/orders/${orderId}`
    );

    const order = await handleResponse(orderResponse);

    // Get the two child tables separately
    const linesResponse = await fetch(
        `${BASE_URL}/order_lines?order_id=${encodeURIComponent(orderId)}`
    );

    const lines = await handleResponse(linesResponse);

    const costsResponse = await fetch(
        `${BASE_URL}/order_additional_costs?order_id=${encodeURIComponent(orderId)}`
    );

    const additionalCosts = await handleResponse(costsResponse);

    return {
        ...order,
        lines,
        additional_costs: additionalCosts
    };
};


const updateOrder = async (orderId, data) => {
    const {
        lines,
        additional_costs,
        ...orderData
    } = data;

    // Update the actual order
    const orderResponse = await fetch(
        `${BASE_URL}/orders/${orderId}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        }
    );

    const order = await handleResponse(orderResponse);

    // Update order lines if supplied
    if (lines !== undefined) {
        const existingLinesResponse = await fetch(
            `${BASE_URL}/order_lines?order_id=${encodeURIComponent(orderId)}`
        );

        const existingLines = await handleResponse(existingLinesResponse);

        const existingIds = new Set(
            existingLines.map((line) => line.id)
        );

        const receivedIds = new Set(
            lines
                .filter((line) => line.id != null)
                .map((line) => line.id)
        );

        // Delete removed lines
        for (const line of existingLines) {
            if (!receivedIds.has(line.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_lines/${line.id}`,
                        {
                            method: 'DELETE'
                        }
                    )
                );
            }
        }

        // Add/update lines
        for (const line of lines) {
            if (existingIds.has(line.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_lines/${line.id}`,
                        {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(line)
                        }
                    )
                );
            } else {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_lines`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                ...line,
                                order_id: orderId
                            })
                        }
                    )
                );
            }
        }
    }

    // Update additional costs if supplied
    if (additional_costs !== undefined) {
        const existingCostsResponse = await fetch(
            `${BASE_URL}/order_additional_costs?order_id=${encodeURIComponent(orderId)}`
        );

        const existingCosts = await handleResponse(existingCostsResponse);

        const existingIds = new Set(
            existingCosts.map((cost) => cost.id)
        );

        const receivedIds = new Set(
            additional_costs
                .filter((cost) => cost.id != null)
                .map((cost) => cost.id)
        );

        // Delete removed costs
        for (const cost of existingCosts) {
            if (!receivedIds.has(cost.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_additional_costs/${cost.id}`,
                        {
                            method: 'DELETE'
                        }
                    )
                );
            }
        }

        // Add/update costs
        for (const cost of additional_costs) {
            if (existingIds.has(cost.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_additional_costs/${cost.id}`,
                        {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(cost)
                        }
                    )
                );
            } else {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/order_additional_costs`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                ...cost,
                                order_id: orderId
                            })
                        }
                    )
                );
            }
        }
    }

    // Return the complete updated order
    return await getOrder(orderId);
};


// =========================
// MATERIAL
// =========================

const getMaterial = async (materialId) => {
    const materialResponse = await fetch(
        `${BASE_URL}/materials/${materialId}`
    );

    const material = await handleResponse(materialResponse);

    const bomResponse = await fetch(
        `${BASE_URL}/bom_lines?material_id=${encodeURIComponent(materialId)}`
    );

    const bomLines = await handleResponse(bomResponse);

    return {
        ...material,
        bom_lines: bomLines
    };
};


const updateMaterial = async (materialId, data) => {
    const {
        bom_lines,
        ...materialData
    } = data;

    // Update the material itself
    const materialResponse = await fetch(
        `${BASE_URL}/materials/${materialId}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(materialData)
        }
    );

    await handleResponse(materialResponse);

    // Update BOM lines separately
    if (bom_lines !== undefined) {
        const existingResponse = await fetch(
            `${BASE_URL}/bom_lines?material_id=${encodeURIComponent(materialId)}`
        );

        const existingLines = await handleResponse(existingResponse);

        const existingIds = new Set(
            existingLines.map((line) => line.id)
        );

        const receivedIds = new Set(
            bom_lines
                .filter((line) => line.id != null)
                .map((line) => line.id)
        );

        // Delete BOM lines that no longer exist
        for (const line of existingLines) {
            if (!receivedIds.has(line.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/bom_lines/${line.id}`,
                        {
                            method: 'DELETE'
                        }
                    )
                );
            }
        }

        // Add or update BOM lines
        for (const line of bom_lines) {
            if (existingIds.has(line.id)) {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/bom_lines/${line.id}`,
                        {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(line)
                        }
                    )
                );
            } else {
                await handleResponse(
                    await fetch(
                        `${BASE_URL}/bom_lines`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                ...line,
                                material_id: materialId
                            })
                        }
                    )
                );
            }
        }
    }

    return await getMaterial(materialId);
};


// =========================
// MAIN FUNCTION
// =========================

export const apiRequest = async (
    dataType,
    command,
    id = null,
    body = null
) => {

    // Order special handling
    if (
        dataType === 'orders' &&
        (command === 'get' || command === 'update')
    ) {
        if (id == null) {
            throw new Error(`ID is required for order ${command}`);
        }

        if (command === 'get') {
            return await getOrder(id);
        }

        return await updateOrder(id, body);
    }


    // Material special handling
    if (
        dataType === 'materials' &&
        (command === 'get' || command === 'update')
    ) {
        if (id == null) {
            throw new Error(`ID is required for material ${command}`);
        }

        if (command === 'get') {
            return await getMaterial(id);
        }

        return await updateMaterial(id, body);
    }


    // =========================
    // GENERIC REQUEST
    // =========================

    let method;
    let url = `${BASE_URL}/${dataType}`;

    switch (command) {
        case 'get':
            method = 'GET';

            if (id != null) {
                url += `/${id}`;
            }

            break;

        case 'add':
            method = 'POST';
            break;

        case 'update':
            method = 'PUT';

            if (id == null) {
                throw new Error('ID is required for update');
            }

            url += `/${id}`;
            break;

        case 'delete':
            method = 'DELETE';

            if (id == null) {
                throw new Error('ID is required for delete');
            }

            url += `/${id}`;
            break;

        default:
            throw new Error(`Unknown command: ${command}`);
    }

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== null && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    return await handleResponse(
        await fetch(url, options)
    );
};