'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, UserCheck, UserX, Trash2, Edit2, Plus, X, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import WhatsAppField from '@/components/WhatsAppField';

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  whatsapp?: string;
  systemRole: string;
  isApproved: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscador + paginación
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState({ email: '', password: '', displayName: '', whatsapp: '', systemRole: 'user', isApproved: true });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const roleCycle: Record<string, string> = {
      admin: 'asesor',
      asesor: 'empresa',
      empresa: 'admin',
      user: 'asesor',
    };
    const newRole = roleCycle[currentRole] || 'empresa';
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

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      
      setIsAddModalOpen(false);
      setFormData({ email: '', password: '', displayName: '', whatsapp: '', systemRole: 'user', isApproved: true });
      fetchUsers(); // Recargar lista
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          whatsapp: formData.whatsapp,
          systemRole: formData.systemRole,
          isApproved: formData.isApproved
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al editar usuario');
      
      setIsEditModalOpen(false);
      fetchUsers(); // Recargar lista
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  function openEditModal(user: UserData) {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '', // Password cannot be viewed, only changed if needed (we omit it for now)
      displayName: user.displayName || '',
      whatsapp: user.whatsapp || '',
      systemRole: user.systemRole,
      isApproved: user.isApproved
    });
    setIsEditModalOpen(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.displayName, u.whatsapp, u.systemRole].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [users, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * perPage, safePage * perPage);

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
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-0.5">Administra los accesos y roles del sistema.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ email: '', password: '', displayName: '', whatsapp: '', systemRole: 'user', isApproved: true });
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Crear Usuario
        </button>
      </div>

      {/* Buscador + límite */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre, correo, teléfono o rol…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">Límite</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none cursor-pointer shadow-sm min-w-[70px] text-center"
          >
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Teléfono</th>
                <th className="px-6 py-4">Fecha Registro</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slice.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{u.displayName || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    {u.whatsapp || <span className="text-slate-400">N/A</span>}
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
                          : u.systemRole === 'asesor'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {u.systemRole === 'user' ? 'EMPRESA' : u.systemRole}
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
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors inline-flex"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {query ? 'Sin resultados para la búsqueda.' : 'No hay usuarios registrados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
            {filtered.length} Usuario{filtered.length !== 1 ? 's' : ''} · Pág {safePage}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center bg-white shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium text-slate-600 px-2 tabular-nums">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center bg-white shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREAR USUARIO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Crear nuevo usuario</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              {formError && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">{formError}</div>}
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Nombre completo</label>
                <input type="text" required value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="Ej. Juan Pérez" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Correo electrónico</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="correo@ejemplo.com" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Contraseña</label>
                <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>

              <WhatsAppField
                label="WhatsApp (opcional)"
                value={formData.whatsapp}
                onChange={(v) => setFormData({ ...formData, whatsapp: v })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Rol</label>
                  <select value={formData.systemRole} onChange={e => setFormData({...formData, systemRole: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 outline-none bg-white font-semibold text-slate-700">
                    <option value="admin">ADMIN</option>
                    <option value="asesor">ASESOR</option>
                    <option value="empresa">EMPRESA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Estado</label>
                  <select value={formData.isApproved ? 'true' : 'false'} onChange={e => setFormData({...formData, isApproved: e.target.value === 'true'})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 outline-none bg-white font-semibold text-slate-700">
                    <option value="true">APROBADO</option>
                    <option value="false">PENDIENTE</option>
                  </select>
                </div>
              </div>


              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={formLoading} className="flex items-center justify-center min-w-[100px] px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Editar usuario</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-5 space-y-4">
              {formError && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">{formError}</div>}
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Correo (No editable)</label>
                <input type="email" disabled value={formData.email} className="w-full text-sm border border-slate-200 bg-slate-50 text-slate-400 rounded-xl px-3 py-2.5 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Nombre completo</label>
                <input type="text" required value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="Ej. Juan Pérez" />
              </div>

              <WhatsAppField
                label="Teléfono (WhatsApp)"
                value={formData.whatsapp}
                onChange={(v) => setFormData({ ...formData, whatsapp: v })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Rol</label>
                  <select value={formData.systemRole === 'user' ? 'empresa' : formData.systemRole} onChange={e => setFormData({...formData, systemRole: e.target.value})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 outline-none bg-white font-semibold text-slate-700">
                    <option value="admin">ADMIN</option>
                    <option value="asesor">ASESOR</option>
                    <option value="empresa">EMPRESA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Estado</label>
                  <select value={formData.isApproved ? 'true' : 'false'} onChange={e => setFormData({...formData, isApproved: e.target.value === 'true'})} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 outline-none bg-white font-semibold text-slate-700">
                    <option value="true">APROBADO</option>
                    <option value="false">PENDIENTE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={formLoading} className="flex items-center justify-center min-w-[100px] px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
