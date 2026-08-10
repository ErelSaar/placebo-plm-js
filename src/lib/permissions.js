import { STORAGE_KEYS } from '../lib/constants';
import { getItems } from '../lib/data/storage';

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

function createFakeUser() {
    return {
        id: Math.floor(Math.random() * 1000000),
        username: `user_1`,
        password: '$2b$10$FAKE_HASHED_PASSWORD_FOR_TESTING_ONLY',
        profile_picture: '',
        created_at: new Date(),
        role: 'guest'
    };
}

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

    if (users.length === 0) {
        const fakeUser = createFakeUser();

        localStorage.setItem(
            STORAGE_KEYS.logged_user,
            JSON.stringify([fakeUser])
        );

        setPermission(fakeUser);
        return fakeUser;
    }

    const storedUser = users[0];
    const fakeUser = createFakeUser();

    const fieldsToCheck = [
        'username',
        'password',
        'profile_picture',
        'role'
    ];

    const hasChanged = fieldsToCheck.some(
        field => storedUser[field] !== fakeUser[field]
    );

    if (hasChanged) {
        const updatedUser = {
            ...fakeUser,
            id: storedUser.id,
            created_at: storedUser.created_at
        };

        localStorage.setItem(
            STORAGE_KEYS.logged_user,
            JSON.stringify([updatedUser])
        );

        setPermission(updatedUser);
        return updatedUser;
    }

    setPermission(storedUser);
    return storedUser;
}

setPermission(fakeUser);

export { initializePermission, setPermission, getPermission };