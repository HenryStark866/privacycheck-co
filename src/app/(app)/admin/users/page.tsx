'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, UserCheck, UserX, Trash2, Edit2, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  systemRole: string;
  isApproved: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('No se pudo cargar la lista de usuarios');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleApproval(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: !currentStatus }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isApproved: !currentStatus } : u))
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`¿Cambiar rol a ${newRole.toUpperCase()}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemRole: newRole }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, systemRole: newRole } : u))
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('¿Seguro que deseas eliminar este usuario de forma permanente?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-0.5">Administra los accesos y roles del sistema.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Fecha Registro</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{u.displayName || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDate(u.createdAt as any)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleRole(u.id, u.systemRole)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border transition-colors ${
                        u.systemRole === 'admin'
                          ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {u.systemRole}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleApproval(u.id, u.isApproved)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase transition-colors ${
                        u.isApproved
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {u.isApproved ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      {u.isApproved ? 'Aprobado' : 'Pendiente'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
