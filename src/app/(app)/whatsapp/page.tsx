'use client';

import { useState, useEffect } from 'react';
import { 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  MessageSquare, 
  HelpCircle,
  Copy,
  Terminal,
  RefreshCw
} from 'lucide-react';

interface WhatsAppSession {
  id: string;
  name: string;
  status: 'INITIALIZING' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
  phoneNumber?: string;
  qr?: string;
}

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [adminNumber, setAdminNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cargar estado de WhatsApp y número de administrador
  const fetchData = async () => {
    try {
      const statusRes = await fetch('/api/whatsapp/status');
      const statusData = await statusRes.json();
      
      if (!statusRes.ok || !statusData.ok) {
        throw new Error(statusData.error || 'No se pudo contactar con OpenWA');
      }
      
      setSession(statusData.session);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'El servidor de WhatsApp (OpenWA) no está respondiendo.');
      setSession(null);
    }

    try {
      const numRes = await fetch('/api/whatsapp/admin-number');
      const numData = await numRes.json();
      if (numRes.ok && numData.ok) {
        setAdminNumber(numData.adminNumber);
      }
    } catch (err) {
      console.error('Error cargando el número del administrador:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling del estado si está en proceso de escaneo o inicialización
  useEffect(() => {
    if (!session || session.status === 'CONNECTED') return;

    const interval = setInterval(() => {
      fetchData();
    }, 4000); // Polling cada 4 segundos

    return () => clearInterval(interval);
  }, [session?.status]);

  const handleSaveNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/whatsapp/admin-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNumber }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Error al guardar el número');
      }
    } catch (err) {
      console.error('Error al guardar el número de administrador:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Vincular WhatsApp</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Conecta tu número personal o corporativo para consultar la base de datos y la Ley 1581 desde el chat de WhatsApp.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Consultando estado del gateway de WhatsApp...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Columna Principal: Estado e Integración */}
          <div className="md:col-span-2 space-y-6">
            {/* Panel de Estado de Conexión */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-gray-600" />
                  <h2 className="text-sm font-semibold text-gray-900">Estado del Servicio</h2>
                </div>
                <button 
                  onClick={() => { setLoading(true); fetchData(); }}
                  className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-500 transition-colors"
                  title="Actualizar estado"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                {error ? (
                  /* ERROR - OpenWA caido */
                  <div className="space-y-4">
                    <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4 text-red-700">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">Servicio OpenWA desconectado</p>
                        <p className="text-xs text-red-600/90 mt-1">
                          La aplicación Next.js no pudo comunicarse con el servidor de la API de WhatsApp.
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs space-y-2 border border-gray-800">
                      <div className="flex items-center gap-1.5 text-gray-400 border-b border-gray-800 pb-1.5 mb-2">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Instrucciones para iniciar OpenWA</span>
                      </div>
                      <p className="text-gray-400"># 1. Abre una terminal de comandos en Windows</p>
                      <p className="text-gray-400"># 2. Navega al directorio del proyecto y arranca el gateway:</p>
                      <p className="text-yellow-400">cd "c:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026\OpenWA-main"</p>
                      <p className="text-green-400">npm run dev</p>
                      <p className="text-gray-400 mt-2"># 3. Espera a que la terminal muestre: "Nest application successfully started"</p>
                    </div>
                  </div>
                ) : session ? (
                  /* SERVICIO ACTIVO - Mostrando estados */
                  <div className="space-y-6">
                    {session.status === 'CONNECTED' && (
                      <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-2xl p-5 text-green-800">
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-base font-bold">¡WhatsApp Conectado!</p>
                          <p className="text-xs text-green-700 mt-0.5">
                            Tu sesión se encuentra en línea y respondiendo activamente consultas de Ley 1581.
                          </p>
                          {session.phoneNumber && (
                            <p className="text-xs font-semibold text-green-900 mt-1">
                              Número vinculado: +{session.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {session.status === 'SCAN_QR' && (
                      <div className="flex flex-col items-center py-4 space-y-6">
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-gray-900">Vincular dispositivo con código QR</p>
                          <p className="text-xs text-gray-500">
                            Abre WhatsApp en tu teléfono celular → Menú (︙) o Configuración → Dispositivos vinculados → Vincular un dispositivo.
                          </p>
                        </div>

                        {session.qr ? (
                          <div className="relative p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                            <img 
                              src={session.qr} 
                              alt="Código QR de WhatsApp" 
                              className="w-56 h-56 transition-all duration-300"
                            />
                            <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                              {/* Overlay de hover */}
                            </div>
                          </div>
                        ) : (
                          <div className="w-56 h-56 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300 mb-2" />
                            <span className="text-[10px] font-medium">Generando nuevo QR...</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-brand-600 bg-brand-50 border border-brand-100/50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse">
                          <span className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                          Esperando el escaneo en tiempo real...
                        </div>
                      </div>
                    )}

                    {(session.status === 'INITIALIZING' || session.status === 'CONNECTING') && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                        <p className="text-sm text-gray-600 font-medium">
                          {session.status === 'INITIALIZING' 
                            ? 'Inicializando el motor de WhatsApp...' 
                            : 'Estableciendo conexión con los servidores de WhatsApp...'}
                        </p>
                        <p className="text-xs text-gray-400">Esto puede tomar hasta un minuto.</p>
                      </div>
                    )}

                    {(session.status === 'DISCONNECTED' || session.status === 'FAILED') && (
                      <div className="text-center py-6 space-y-4">
                        <div className="inline-flex w-12 h-12 rounded-full bg-amber-50 text-amber-600 items-center justify-center">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900">Sesión desconectada o fallida</p>
                          <p className="text-xs text-gray-500">
                            La sesión local de WhatsApp requiere re-autenticación.
                          </p>
                        </div>
                        <button 
                          onClick={() => { setLoading(true); fetchData(); }}
                          className="btn-primary inline-flex"
                        >
                          Intentar reconectar
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Guía de Comandos y Uso */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <HelpCircle className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-semibold text-gray-900">¿Cómo interactuar con el Asistente?</h3>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Una vez que escanees el código QR y tu sesión esté *CONNECTED*, puedes enviar mensajes desde tu teléfono registrado como administrador.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-3.5 space-y-1.5">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                      Consultas en Lenguaje Natural
                    </p>
                    <p className="text-[11px] text-gray-500 italic">
                      "¿Cómo va el diagnóstico de cumplimiento de Bancolombia?"
                    </p>
                    <p className="text-[11px] text-gray-500 italic">
                      "¿Qué empresas tienen un puntaje menor al 60%?"
                    </p>
                  </div>

                  <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-3.5 space-y-1.5">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5 text-brand-600" />
                      Comandos Directos
                    </p>
                    <div className="space-y-1 text-[11px] text-gray-600 font-mono">
                      <div><span className="font-bold">empresas</span> - Lista las empresas</div>
                      <div><span className="font-bold">empresa [nombre]</span> - Detalle empresa</div>
                      <div><span className="font-bold">ayuda</span> - Muestra el menú</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Lateral: Configuración de Administrador */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Smartphone className="w-5 h-5 text-brand-600" />
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Número de Admin</h3>
              </div>

              <form onSubmit={handleSaveNumber} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Número de WhatsApp</label>
                  <input
                    type="text"
                    value={adminNumber}
                    onChange={(e) => setAdminNumber(e.target.value)}
                    placeholder="Ej: 573001234567"
                    className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-gray-800"
                  />
                  <p className="text-[10px] text-gray-400 leading-normal mt-1">
                    Ingresa tu número con el código de país (ej. 57 para Colombia). Solo este número recibirá respuestas de base de datos.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full btn-primary py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  {saveLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar número
                </button>

                {saveSuccess && (
                  <div className="text-[11px] font-semibold text-green-600 bg-green-50 border border-green-100 text-center py-1.5 rounded-lg animate-fade-in">
                    Número guardado con éxito
                  </div>
                )}
              </form>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-3">
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-2">
                Especificación Técnica
              </p>
              <div className="space-y-2 text-[11px] text-gray-500 leading-relaxed">
                <div>
                  <span className="font-semibold text-gray-700">Motor:</span> whatsapp-web.js (headless Puppeteer)
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Webhook:</span> /api/whatsapp/webhook
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Modelo AI:</span> Gemini 1.5 Flash (API Key en servidor)
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Seguridad:</span> Validador de JID en cabeceras de consulta
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
