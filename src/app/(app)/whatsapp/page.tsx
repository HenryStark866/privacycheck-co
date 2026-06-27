'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, CheckCircle2, AlertCircle, Loader2,
  Save, MessageSquare, HelpCircle, RefreshCw, Terminal,
  Users, Send, Wifi, WifiOff,
} from 'lucide-react';

interface WASession {
  id: string;
  name: string;
  status: 'INITIALIZING' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
  phoneNumber?: string;
  qr?: string;
}

interface RegisteredUser {
  uid: string;
  email: string;
  displayName: string;
  whatsapp: string;
}

export default function WhatsAppPage() {
  const [session, setSession]         = useState<WASession | null>(null);
  const [adminNumber, setAdminNumber] = useState('');
  const [users, setUsers]             = useState<RegisteredUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendTo, setSendTo]           = useState('');
  const [sendText, setSendText]       = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, numRes, usersRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/admin-number'),
        fetch('/api/whatsapp/users'),
      ]);

      if (!statusRes.ok) throw new Error((await statusRes.json()).error || 'Sin respuesta de OpenWA');
      const statusData = await statusRes.json();
      setSession(statusData.session);
      setError(null);

      if (numRes.ok) setAdminNumber((await numRes.json()).adminNumber ?? '');
      if (usersRes.ok) setUsers((await usersRes.json()).users ?? []);
    } catch (err: any) {
      setError(err.message || 'El servidor OpenWA no responde.');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!session || session.status === 'CONNECTED') return;
    const id = setInterval(fetchStatus, 4000);
    return () => clearInterval(id);
  }, [session, fetchStatus]);

  const handleSaveNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    const res = await fetch('/api/whatsapp/admin-number', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNumber }),
    });
    if (res.ok) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
    setSaveLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendLoading(true);
    setSendResult(null);
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: sendTo, text: sendText }),
    });
    const d = await res.json();
    setSendResult({ ok: res.ok, msg: res.ok ? '✅ Mensaje enviado' : (d.error ?? 'Error al enviar') });
    if (res.ok) { setSendTo(''); setSendText(''); }
    setSendLoading(false);
  };

  const statusBadge: Record<string, string> = {
    CONNECTED:    'bg-green-500',
    SCAN_QR:      'bg-yellow-400',
    CONNECTING:   'bg-blue-500',
    INITIALIZING: 'bg-blue-400',
    DISCONNECTED: 'bg-gray-400',
    FAILED:       'bg-red-500',
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-green-500" />
          Gateway WhatsApp
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Consulta tus empresas y la Ley 1581 directamente desde WhatsApp.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-sm text-gray-400">Consultando estado de OpenWA…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Columna principal ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Estado gateway */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {error ? <WifiOff className="w-4 h-4 text-red-500" /> : <Wifi className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm font-semibold text-gray-800">Estado del servicio</span>
                  {session && (
                    <span className={`ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${statusBadge[session.status] ?? 'bg-gray-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                      {session.status}
                    </span>
                  )}
                </div>
                <button onClick={() => { setLoading(true); fetchStatus(); }} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                {error ? (
                  <div className="space-y-5">
                    <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4 text-red-700">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">OpenWA no responde</p>
                        <p className="text-xs text-red-600/80 mt-0.5">El gateway de WhatsApp no está corriendo localmente.</p>
                      </div>
                    </div>
                    <div className="bg-gray-950 text-gray-100 rounded-xl p-4 font-mono text-xs space-y-1.5 border border-gray-800">
                      <div className="flex items-center gap-1.5 text-gray-500 pb-2 border-b border-gray-800">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Iniciar OpenWA localmente (Windows)</span>
                      </div>
                      <p className="text-gray-500"># Abre una terminal y ejecuta:</p>
                      <p className="text-yellow-400 break-all">cd &quot;C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026\OpenWA-main&quot;</p>
                      <p className="text-green-400">npm run dev</p>
                      <p className="text-gray-500 pt-1"># Espera: &quot;Nest application successfully started&quot;</p>
                    </div>
                  </div>
                ) : session?.status === 'CONNECTED' ? (
                  <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-2xl p-5">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-green-800">¡WhatsApp conectado!</p>
                      <p className="text-xs text-green-700 mt-0.5">El bot está activo y respondiendo mensajes en tiempo real.</p>
                      {session.phoneNumber && (
                        <p className="text-xs font-semibold text-green-900 mt-1">Número vinculado: +{session.phoneNumber}</p>
                      )}
                    </div>
                  </div>
                ) : session?.status === 'SCAN_QR' ? (
                  <div className="flex flex-col items-center gap-5 py-4">
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-900">Escanea el código QR</p>
                      <p className="text-xs text-gray-500 mt-1">WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo</p>
                    </div>
                    {session.qr ? (
                      <img src={session.qr} alt="QR WhatsApp" className="w-56 h-56 rounded-2xl border-2 border-gray-100 shadow-sm" />
                    ) : (
                      <div className="w-56 h-56 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                      </div>
                    )}
                    <p className="text-xs text-brand-600 font-medium animate-pulse flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                      Esperando escaneo…
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                    <p className="text-sm text-gray-500">
                      {session?.status === 'INITIALIZING' ? 'Inicializando…' : 'Conectando con WhatsApp…'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Usuarios registrados con WhatsApp */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">Usuarios con WhatsApp vinculado</span>
                <span className="ml-auto text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{users.length}</span>
              </div>
              {users.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Ningún usuario ha vinculado su WhatsApp todavía.
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <li key={u.uid} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-brand-600">
                          {(u.displayName || u.email).slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.displayName || u.email}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <p className="text-xs font-mono text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 shrink-0">
                        {u.whatsapp}
                      </p>
                      <button
                        onClick={() => setSendTo(u.whatsapp.replace('+', ''))}
                        className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"
                        title="Enviar mensaje"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Envío manual */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Send className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-semibold text-gray-800">Enviar mensaje manual</h3>
              </div>
              <form onSubmit={handleSend} className="space-y-3">
                <input
                  type="text" value={sendTo} onChange={(e) => setSendTo(e.target.value)}
                  placeholder="Número destino (ej: 573001234567)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                />
                <textarea
                  value={sendText} onChange={(e) => setSendText(e.target.value)}
                  placeholder="Mensaje…" rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 resize-none"
                  required
                />
                <button
                  type="submit"
                  disabled={sendLoading || !session || session.status !== 'CONNECTED'}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-all disabled:opacity-40"
                >
                  {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
                {sendResult && (
                  <p className={`text-xs text-center font-medium py-1.5 rounded-lg ${sendResult.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                    {sendResult.msg}
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* ── Columna lateral ── */}
          <div className="space-y-5">
            {/* Número admin */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Smartphone className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Admin global</h3>
              </div>
              <form onSubmit={handleSaveNumber} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Número con acceso total
                  </label>
                  <input
                    type="text" value={adminNumber} onChange={(e) => setAdminNumber(e.target.value)}
                    placeholder="573001234567"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Con código de país sin +. Este número ve TODAS las empresas.</p>
                </div>
                <button
                  type="submit" disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-xl py-2.5 transition-all disabled:opacity-40"
                >
                  {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar
                </button>
                {saveSuccess && (
                  <p className="text-[11px] text-green-600 bg-green-50 text-center py-1.5 rounded-lg font-semibold">✓ Guardado</p>
                )}
              </form>
            </div>

            {/* Comandos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <HelpCircle className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Comandos</h3>
              </div>
              <div className="space-y-2 text-[11px]">
                {[
                  { cmd: 'empresas',        desc: 'Tus empresas registradas' },
                  { cmd: 'empresa [nombre]', desc: 'Detalle de empresa' },
                  { cmd: 'todos',            desc: 'Admin: todas las empresas' },
                  { cmd: 'ayuda',            desc: 'Menú de comandos' },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="flex items-start gap-2">
                    <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0">{cmd}</code>
                    <span className="text-gray-500">{desc}</span>
                  </div>
                ))}
                <p className="text-gray-400 pt-1 leading-relaxed">También acepta lenguaje natural. 🤖</p>
              </div>
            </div>

            {/* Info técnica */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-100">Técnico</p>
              {[
                { label: 'Gateway',  val: 'OpenWA / WAHA' },
                { label: 'Webhook', val: '/api/whatsapp/webhook' },
                { label: 'IA',      val: 'Gemini 1.5 Flash' },
                { label: 'Puerto',  val: ':2785 (local)' },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-[11px]">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono text-gray-700 truncate max-w-[130px] text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
