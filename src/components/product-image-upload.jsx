'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp';
const MAX_SIZE_BYTES = 26214400; // 25 MB

/**
 * ProductImageUpload
 *
 * Props:
 *   imageUrl      - string | null  current saved image URL (from product.image_url)
 *   onImageUrlChange - fn(string | null)  called when user removes the existing saved URL
 *   onFileSelect  - fn(File | null)  called when user picks or clears a local file
 *
 * The parent is responsible for uploading the selected File before saving and
 * then passing the resulting URL back via imageUrl.
 */
export function ProductImageUpload({ imageUrl, onImageUrlChange, onFileSelect }) {
  // previewSrc is either an object URL (local file) or the saved imageUrl
  const [previewSrc, setPreviewSrc] = useState(imageUrl || null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const objectUrlRef = useRef(null);

  // Sync with imageUrl changes from parent (e.g. after load or external update)
  useEffect(() => {
    // Only update preview from prop when no local file is staged
    if (!objectUrlRef.current) {
      setPreviewSrc(imageUrl || null);
    }
  }, [imageUrl]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => revokeObjectUrl();
  }, []);

  function revokeObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function handleFileChosen(file) {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please use PNG, JPG, or WebP.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError('File is too large. Maximum size is 25 MB.');
      return;
    }

    setError('');
    revokeObjectUrl();

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewSrc(url);
    onFileSelect?.(file);
  }

  function handleInputChange(e) {
    handleFileChosen(e.target.files?.[0] ?? null);
    // Reset so the same file can be re-selected if needed
    e.target.value = '';
  }

  function handleRemove() {
    setError('');
    revokeObjectUrl();
    setPreviewSrc(null);
    onFileSelect?.(null);
    onImageUrlChange?.(null);
  }

  const hasImage = !!previewSrc;

  return (
    <div className="col-span-2">
      <p className="text-[12px] font-medium text-[#525252] mb-2">Product Image</p>

      {hasImage ? (
        <div>
          <div className="rounded-lg border border-[#e5e5e5] overflow-hidden bg-[#fafafa] max-w-xs">
            <img
              src={previewSrc}
              alt="Product image preview"
              className="w-full object-cover max-h-52"
              onError={() => {
                // Broken remote URL — clear the preview gracefully
                if (previewSrc !== objectUrlRef.current) {
                  setPreviewSrc(null);
                }
              }}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              Change Image
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center w-full max-w-xs h-28 border-2 border-dashed border-[#e5e5e5] rounded-lg text-[#a3a3a3] hover:border-[#525252] hover:text-[#525252] transition-colors cursor-pointer bg-[#fafafa] hover:bg-[#f5f5f5]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 mb-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[12px] font-medium">Add Image</span>
          </button>
          <p className="text-[11px] text-[#a3a3a3] mt-1.5">PNG, JPG or WebP · Max 25 MB</p>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-red-600 mt-1.5">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}

/**
 * attemptImageUpload
 *
 * Attempts to upload a File to the backend /attachments endpoint.
 * Returns the URL string if successful, or null if the endpoint is unavailable.
 *
 * NOTE: The backend /attachments endpoint must exist and return a publicly
 * accessible URL for image persistence to work end-to-end. If the endpoint
 * is not yet implemented, image selection and preview will work but the URL
 * will not be persisted after save.
 */
export async function attemptImageUpload(file, { entityType = 'product', entityId = null, uploadedBy = null } = {}) {
  const formData = new FormData();
  formData.append('entity_type', entityType);
  if (entityId) formData.append('entity_id', entityId);
  formData.append('file_name', file.name);
  formData.append('content_type', file.type);
  formData.append('size_bytes', String(file.size));
  if (uploadedBy) formData.append('uploaded_by', uploadedBy);
  formData.append('file', file);

  const response = await fetch('http://localhost:5173/api/attachments', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (${response.status})`);
  }

  const data = await response.json();
  // Accept common URL field shapes from the backend
  return data.url ?? data.file_url ?? data.s3_url ?? null;
}
