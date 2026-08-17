'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Table, Thead, Tbody, Th, Td, Tr, Select, Badge, Modal,
} from '@/components/ui';
import { getRegisteredUsers, getUser, updateUserRole } from '@/lib/auth';
import { initializePermission, getPermission } from '@/lib/permissions';
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';

import { userRepository } from '@/lib/data/backend-users';
import { auditRepository } from '@/lib/data/backend-audit';

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
];

const ROLE_LABELS = {
  viewer: 'Viewer',
  supplier: 'Supplier',
  editor: 'Editor',
  admin: 'Manager',
  owner: 'Owner',
};

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [pendingRole, setPendingRole] = useState({});
  const [saving, setSaving] = useState(null);
  const [ownerConfirm, setOwnerConfirm] = useState(null); // { userId, currentRole }
  const currentUser = getItems(STORAGE_KEYS.logged_user);

  async function load() {
    initializePermission();
    const permission = getPermission();
    if (permission < 4) {
      router.replace('/');
      return;
    }
    setUsers(await userRepository.getAll());
  }

  useEffect(() => { load(); }, []);

  const permission = getPermission();
  if (permission < 4) return null;

  async function handleRoleChange(userId, newRole) {
    const users = await userRepository.getAll();
    const loggedUser = getUser();
    const currentUser = users.find((user) => (user.id) === (userId));

    if (currentUser?.role === 'owner' && (userId) === (loggedUser?.id)) {
      alert('The owner cannot change their own role');
      return;
    }

    // if (newRole === 'owner' && users.some((user) => user.role === 'owner' && String(user.id) !== String(userId))) {
    //   alert('There can only be one owner');
    //   return;
    // }

    setPendingRole((prev) => ({ ...prev, [userId]: newRole }));
  }

  async function handleSave(userId) {
    const newRole = pendingRole[userId];
    if (!newRole) return;

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (newRole === 'owner' && user.role !== 'owner') {
      setOwnerConfirm({ userId });
      return;
    }

    const before = { ...user };

    try {
      await commitSave(userId, newRole);

      const updatedUser = {
        ...user,
        role: newRole,
      };

      await auditRepository.create({
        user_id: currentUser.id,
        action: 'update',
        entity_type: 'user',
        entity_id: userId,
        before,
        after: updatedUser,
      });
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  }

  async function commitSave(userId, newRole) {
    setSaving(userId);

    try {
      const user = users.find((u) => u.id === userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Update selected user's role in backend
      await userRepository.update(userId, {
        ...user,
        role: newRole,
      });

      // If transferring ownership, demote the current owner
      if (newRole === 'owner') {
        const loggedUser = getUser();

        if (
          loggedUser?.id &&
          String(loggedUser.id) !== String(userId)
        ) {
          const loggedUserData = users.find(
            (u) => String(u.id) === String(loggedUser.id)
          );

          if (loggedUserData) {
            await userRepository.update(loggedUser.id, {
              ...loggedUserData,
              role: 'manager',
            });
          }
        }
      }

      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      await load();
    } finally {
      setSaving(null);
    }
  }

  function handleCancel(userId) {
    setPendingRole((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} registered user${users.length !== 1 ? 's' : ''}`}
      />
      <div className="px-8 py-6">
        {users.length === 0 ? (
          <p className="text-[13px] text-[#737373]">No registered users yet.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Username</Th>
                <Th>Email</Th>
                <Th>Current Role</Th>
                <Th>Change Role</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {users.map((u) => {
                const selectedRole = pendingRole[u.id] ?? u.role;
                const isDirty = pendingRole[u.id] !== undefined && pendingRole[u.id] !== u.role;
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.name || '—'}</Td>
                    <Td>{u.username}</Td>
                    <Td>{u.email || '—'}</Td>
                    <Td>
                      <Badge variant="muted">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    </Td>
                    <Td>
                      <Select
                        value={selectedRole}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="w-36"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      {isDirty && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            loading={saving === u.id}
                            onClick={() => handleSave(u.id)}
                          >
                            Save
                          </Button>
                          <Button size="sm" onClick={() => handleCancel(u.id)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal
        open={!!ownerConfirm}
        onClose={() => setOwnerConfirm(null)}
        title="Assign Owner Role"
        size="sm"
        footer={
          <>
            <Button onClick={() => setOwnerConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                const { userId } = ownerConfirm;
                setOwnerConfirm(null);
                commitSave(userId, 'owner');
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#0a0a0a] mb-3">
          Are you sure you want to assign this user the Owner role?
        </p>
        <p className="text-[13px] text-[#737373]">
          Owners have full access to the system, including User Management and role permissions.
        </p>
      </Modal>
    </div>
  );
}
