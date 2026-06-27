import React from 'react';

/**
 * Fondo interactivo animado: orbes de color difuminados + caricaturas de
 * ciberseguridad (escudo, base de datos, candado, huella, lupa, bug) flotando.
 * Decorativo: pointer-events-none y por debajo del contenido (z-0).
 */
export default function CartoonBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* ── Orbes de color difuminados (dan el aire "vivo") ── */}
      <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-brand-400/30 blur-[110px] animate-float" style={{ animationDuration: '11s' }} />
      <div className="absolute top-1/3 -right-28 w-[460px] h-[460px] rounded-full bg-indigo-400/25 blur-[120px] animate-float" style={{ animationDuration: '13s', animationDelay: '2s' }} />
      <div className="absolute -bottom-40 left-1/4 w-[480px] h-[480px] rounded-full bg-violet-400/20 blur-[130px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-10 left-1/2 w-[300px] h-[300px] rounded-full bg-emerald-300/25 blur-[100px] animate-float" style={{ animationDuration: '9s', animationDelay: '3s' }} />

      {/* Escudo + candado */}
      <div className="absolute top-[8%] left-[5%] opacity-30 animate-float" style={{ animationDuration: '7s' }}>
        <svg width="130" height="130" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 L85 25 V50 C85 75 50 95 50 95 C50 95 15 75 15 50 V25 L50 10 Z" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="4" strokeLinejoin="round" />
          <path d="M25 32 L50 21 V85 C35 70 25 55 25 50 V32 Z" fill="#60A5FA" opacity="0.5" />
          <rect x="35" y="45" width="30" height="25" rx="4" fill="#FBBF24" stroke="#78350F" strokeWidth="3" />
          <rect x="40" y="52" width="20" height="10" rx="2" fill="#FCD34D" />
          <path d="M40 45 V35 C40 25 60 25 60 35 V45" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Documento + lupa (Habeas Data) */}
      <div className="absolute top-[58%] left-[8%] opacity-30 animate-float" style={{ animationDuration: '8s', animationDelay: '2s' }}>
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 15 H60 L80 35 V85 H30 V15 Z" fill="#F3F4F6" stroke="#4B5563" strokeWidth="4" strokeLinejoin="round" />
          <path d="M60 15 V35 H80" fill="#E5E7EB" stroke="#4B5563" strokeWidth="3" strokeLinejoin="round" />
          <rect x="40" y="45" width="30" height="4" rx="2" fill="#9CA3AF" />
          <rect x="40" y="55" width="20" height="4" rx="2" fill="#9CA3AF" />
          <rect x="40" y="65" width="25" height="4" rx="2" fill="#9CA3AF" />
          <circle cx="50" cy="50" r="15" fill="#7DD3FC" stroke="#0369A1" strokeWidth="4" fillOpacity="0.85" />
          <path d="M43 43 A 8 8 0 0 1 50 39" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <line x1="60" y1="60" x2="75" y2="75" stroke="#B45309" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>

      {/* Base de datos */}
      <div className="absolute top-[16%] right-[8%] opacity-30 animate-float" style={{ animationDuration: '9s', animationDelay: '1s' }}>
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="75" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4" />
          <path d="M15 60 V75 A 35 12 0 0 0 85 75 V60 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4" />
          <ellipse cx="50" cy="60" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4" />
          <path d="M15 45 V60 A 35 12 0 0 0 85 60 V45 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4" />
          <ellipse cx="50" cy="45" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4" />
          <path d="M15 30 V45 A 35 12 0 0 0 85 45 V30 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4" />
          <ellipse cx="50" cy="30" rx="35" ry="12" fill="#C4B5FD" stroke="#4C1D95" strokeWidth="4" />
          <circle cx="80" cy="70" r="15" fill="#10B981" stroke="#064E3B" strokeWidth="3" />
          <path d="M73 70 L78 75 L87 64" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="35" cy="53" r="3" fill="#34D399" />
          <circle cx="35" cy="68" r="3" fill="#34D399" />
        </svg>
      </div>

      {/* Bug / hacker */}
      <div className="absolute top-[64%] right-[12%] opacity-25 animate-float" style={{ animationDuration: '6s', animationDelay: '3s' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 35 L20 20" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <path d="M35 50 L15 50" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 65 L20 80" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <path d="M60 35 L80 20" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <path d="M65 50 L85 50" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <path d="M60 65 L80 80" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="50" r="25" fill="#EF4444" stroke="#7F1D1D" strokeWidth="4" />
          <rect x="35" y="40" width="10" height="8" rx="2" fill="#000000" />
          <rect x="55" y="40" width="10" height="8" rx="2" fill="#000000" />
          <circle cx="38" cy="42" r="2" fill="#10B981" />
          <circle cx="58" cy="42" r="2" fill="#10B981" />
          <path d="M40 25 C35 15 25 15 25 15" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M60 25 C65 15 75 15 75 15" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Huella digital (biometría) */}
      <div className="absolute top-[40%] right-[30%] opacity-25 animate-pulse-slow" style={{ animationDelay: '1.5s' }}>
        <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
          <path d="M5 19.5C5.5 18 6 16 6 12a6 6 0 0 1 .34-2" />
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
          <path d="M8.65 22c.21-.66.45-1.32.57-2" />
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
          <path d="M2 16h.01" />
          <path d="M21.8 16c.2-2 .131-5.354 0-6" />
          <path d="M12 6a6 6 0 0 1 6 6v2" />
        </svg>
      </div>

      {/* Candado pequeño */}
      <div className="absolute top-[34%] left-[28%] opacity-30 animate-pulse-slow" style={{ animationDelay: '1s' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {/* Ojo (vigilancia/privacidad) */}
      <div className="absolute top-[78%] left-[48%] opacity-25 animate-float" style={{ animationDuration: '7s', animationDelay: '2s' }}>
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>

      {/* Check de cumplimiento */}
      <div className="absolute top-[12%] left-[44%] opacity-25 animate-pulse-slow" style={{ animationDelay: '0.5s' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4 12 14.01l-3-3" />
        </svg>
      </div>
    </div>
  );
}
