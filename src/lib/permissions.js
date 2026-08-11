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

    // if (users.length === 0) {
    //     fakeUser = createFakeUser();

    //     localStorage.setItem(
    //         STORAGE_KEYS.logged_user,
    //         JSON.stringify([fakeUser])
    //     );

    //     setPermission(fakeUser);
    //     return fakeUser;
    // }

    const storedUser = users;
    setPermission(storedUser);
}

export { initializePermission, setPermission, getPermission };