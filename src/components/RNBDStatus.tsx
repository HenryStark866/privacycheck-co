'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, Database } from 'lucide-react';
import type { RNBDResult } from '@/app/api/rnbd/route';

interface Props {
  companyId: string;
  nit?: string;
  razonSocial?: string;
}

export default function RNBDStatus({ companyId, nit, razonSocial }: Props) {
  const [result, setResult] = useState<RNBDResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);

  const canQuery = !!(nit || razonSocial);

  async function consultar() {
    if (!canQuery) return;
    setLoading(true);
    try {
      const param = nit
        ? `nit=${encodeURIComponent(nit)}`
        : `razon=${encodeURIComponent(razonSocial!)}`;
      const res = await fetch(`/api/rnbd?${param}&companyId=${companyId}`);
      const data: RNBDResult = await res.json();
      setResult(data);
      setQueried(true);
    } catch {
      setResult({
        encontrado: false,
        estado: 'error',
        mensaje: 'No se pudo conectar con el portal RNBD. Intenta de nuevo o consulta directamente en rnbd.sic.gov.co.',
        url: 'https://rnbd.sic.gov.co',
        consultadoEn: new Date().toISOString(),
      });
      setQueried(true);
    } finally {
      setLoading(false);
    }
  }

  // Consultar automáticamente al montar si hay NIT
  useEffect(() => {
    if (nit && !queried) consultar();
  }, [nit]); // eslint-disable-line

  const iconMap = {
    registrado: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />,
    no_registrado: <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
    no_obligado: <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
    error: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    no_aplica: <AlertTriangle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />,
  };

  const bgMap = {
    registrado: 'bg-green-50 border-green-200',
    no_registrado: 'bg-red-50 border-red-200',
    no_obligado: 'bg-blue-50 border-blue-200',
    error: 'bg-amber-50 border-amber-200',
    no_aplica: 'bg-gray-50 border-gray-200',
  };

  const badgeMap = {
    registrado: 'bg-green-100 text-green-800',
    no_registrado: 'bg-red-100 text-red-800',
    no_obligado: 'bg-blue-100 text-blue-800',
    error: 'bg-amber-100 text-amber-800',
    no_aplica: 'bg-gray-100 text-gray-600',
  };

  const labelMap = {
    registrado: 'Inscrita en RNBD ✓',
    no_registrado: 'No inscrita en RNBD',
    no_obligado: 'No obligada a registrarse',
    error: 'Portal no disponible',
    no_aplica: 'Sin NIT para consultar',
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-400" />
          Registro Nacional de Bases de Datos (RNBD)
        </h2>
        {canQuery && (
          <button
            onClick={consultar}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {queried ? 'Actualizar consulta' : 'Consultar RNBD'}
          </button>
        )}
      </div>

      {/* Sin NIT */}
      {!canQuery && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          Para consultar el RNBD automáticamente, agrega el NIT de la empresa en los datos de la organización.
        </div>
      )}

      {/* Cargando */}
      {loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3 text-sm text-gray-600">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
          Consultando portal RNBD de la SIC…
        </div>
      )}

      {/* Resultado */}
      {result && !loading && (
        <div className={`border rounded-xl p-4 space-y-3 ${bgMap[result.estado]}`}>
          <div className="flex items-start gap-3">
            {iconMap[result.estado]}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badgeMap[result.estado]}`}>
                  {labelMap[result.estado]}
                </span>
                {result.numeroBD !== undefined && (
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                    {result.numeroBD} base{result.numeroBD !== 1 ? 's' : ''} de datos
                  </span>
                )}
                {result.tienePolitica !== undefined && (
                  <span className={`text-xs rounded-full px-2.5 py-0.5 ${
                    result.tienePolitica
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    Política {result.tienePolitica ? 'reportada ✓' : 'no reportada ✗'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.mensaje}</p>
            </div>
          </div>

          {/* Info adicional */}
          <div className="border-t border-black/10 pt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-gray-500">
              Consultado: {new Date(result.consultadoEn).toLocaleString('es-CO')}
            </div>
            <a
              href="https://rnbd.sic.gov.co"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
            >
              Verificar en portal oficial <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Explicación de la regla */}
      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">¿Quiénes deben inscribirse en el RNBD?</p>
          <p>
            Según la SIC, <strong>solo las personas jurídicas con activos totales superiores a 100.000 UVT</strong>{' '}
            (~$4.740 millones COP en 2024) están obligadas a registrarse. Las empresas pequeñas y medianas no están
            obligadas al registro, pero sí deben cumplir con la Ley 1581 en todos sus demás aspectos
            (política de privacidad, autorización de titulares, seguridad de datos, etc.).
          </p>
        </div>
      )}
    </div>
  );
}
