import { v4 as uuidv4 } from 'uuid';
import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const KEY = STORAGE_KEYS.audit_log;

let records = getItems(KEY);

export const recordRepository = {
  getAll() {
    return records;
  },

  getById(id) {
    return records.find((record) => record.id === id) ?? null;
  },

  create({
    user_id,
    action,
    entity_type,
    entity_id,
    before = null,
    after = null,
  }) {
    const record = {
      id: uuidv4(),
      user_id,
      action,
      entity_type,
      entity_id,
      before,
      after,
      ip_address: '',
      created_at: new Date().toISOString(),
    };

    records.push(record);
    setItems(KEY, records);

    return record;
  },
};