import { STORAGE_KEYS } from '../lib/constants';
import { getItems } from '../lib/data/storage';

var fakeUser = {
    role: "editor"
};

let permission = null;

const ROLE_PERMISSIONS = {
    viewer: 0,
    supplier: 1,
    editor: 2,
    admin: 3,
    owner: 4
};

function setPermission(user) {
    if (!user) {
        permission = null;
        return;
    }

    permission = ROLE_PERMISSIONS[user.role] ?? 0;
}

function getPermission() {
    return permission;
}

function initializePermission() {
    const users = getItems(STORAGE_KEYS.logged_user);

    const storedUser = users;
    setPermission(storedUser);
}

function canViewAdministration() {
    initializePermission();
    return getPermission() >= 3; // admin (Manager) or owner
}

function canManageUsers() {
    initializePermission();
    return getPermission() >= 4; // owner only
}

function canViewAuditLog() {
    initializePermission();
    return getPermission() >= 3; // admin (Manager) or owner
}

function canViewSpam() {
    initializePermission();
    return getPermission() >= 4; // owner only
}

export { initializePermission, setPermission, getPermission, canViewAdministration, canManageUsers, canViewAuditLog, canViewSpam };