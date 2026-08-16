const attachment = {
    entity_type: null,
    entity_id: null,
    file_name: null,
    s3_key: null,
    content_type: null,
    size_bytes: null,
    uploaded_by: null,
    file: null
};


export function selectAttachment(file, {
    entity_type,
    uploaded_by
}) {
    if (!file) {
        resetAttachment();
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Unsupported file type.");
    }

    if (file.size > 26214400) {
        throw new Error("File cannot exceed 25 MB.");
    }

    attachment.entity_type = entity_type;
    attachment.entity_id = null;

    attachment.file_name = file.name;
    attachment.s3_key = null;
    attachment.content_type = file.type;
    attachment.size_bytes = file.size;
    attachment.uploaded_by = uploaded_by;

    // Actual browser File object
    attachment.file = file;

    return attachment;
}


export async function sendAttachment(entity_id) {
    if (!attachment.file) {
        return null;
    }

    attachment.entity_id = entity_id;

    const formData = new FormData();

    formData.append("entity_type", attachment.entity_type);
    formData.append("entity_id", attachment.entity_id);
    formData.append("file_name", attachment.file_name);
    formData.append("content_type", attachment.content_type);
    formData.append("size_bytes", attachment.size_bytes);

    if (attachment.uploaded_by) {
        formData.append(
            "uploaded_by",
            attachment.uploaded_by
        );
    }

    formData.append("file", attachment.file);

    const response = await fetch(
        `${BASE_URL}/attachments`,
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Failed to upload attachment"
        );
    }

    resetAttachment();

    return data;
}


export function getAttachment() {
    return attachment;
}


export function resetAttachment() {
    attachment.entity_type = null;
    attachment.entity_id = null;
    attachment.file_name = null;
    attachment.s3_key = null;
    attachment.content_type = null;
    attachment.size_bytes = null;
    attachment.uploaded_by = null;
    attachment.file = null;
}