const fakeUser = {
    role: "employee"
};

let permission = null;

const ROLE_PERMISSIONS = {
    guest: 0,
    employee: 1,
    manager: 2,
    admin: 3,
    superadmin: 4,
    owner: 5
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
    if (permission === null) {
        setPermission(fakeUser);
    }
}

setPermission(fakeUser);

export { initializePermission, setPermission, getPermission };