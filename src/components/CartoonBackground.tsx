import React from 'react';

export default function CartoonBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Cartoon Shield & Lock */}
      <div 
        className="absolute top-[10%] left-[5%] opacity-20 animate-float"
        style={{ animationDuration: '7s', animationDelay: '0s' }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Escudo Base */}
          <path d="M50 10 L85 25 V50 C85 75 50 95 50 95 C50 95 15 75 15 50 V25 L50 10 Z" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="4" strokeLinejoin="round"/>
          {/* Brillo del escudo */}
          <path d="M25 32 L50 21 V85 C35 70 25 55 25 50 V32 Z" fill="#60A5FA" opacity="0.5"/>
          {/* Candado Cuerpo */}
          <rect x="35" y="45" width="30" height="25" rx="4" fill="#FBBF24" stroke="#78350F" strokeWidth="3"/>
          <rect x="40" y="52" width="20" height="10" rx="2" fill="#FCD34D" />
          {/* Candado Arco */}
          <path d="M40 45 V35 C40 25 60 25 60 35 V45" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round"/>
          <path d="M40 45 V35 C40 25 60 25 60 35 V45" stroke="#4B5563" strokeWidth="1" strokeDasharray="5 5" fill="none"/>
        </svg>
      </div>

      {/* Cartoon Document & Magnifying Glass (Habeas Data) */}
      <div 
        className="absolute top-[60%] left-[10%] opacity-20 animate-float"
        style={{ animationDuration: '8s', animationDelay: '2s' }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Hoja de papel */}
          <path d="M30 15 H60 L80 35 V85 H30 V15 Z" fill="#F3F4F6" stroke="#4B5563" strokeWidth="4" strokeLinejoin="round"/>
          {/* Doblez */}
          <path d="M60 15 V35 H80" fill="#E5E7EB" stroke="#4B5563" strokeWidth="3" strokeLinejoin="round"/>
          {/* Líneas de texto */}
          <rect x="40" y="45" width="30" height="4" rx="2" fill="#9CA3AF"/>
          <rect x="40" y="55" width="20" height="4" rx="2" fill="#9CA3AF"/>
          <rect x="40" y="65" width="25" height="4" rx="2" fill="#9CA3AF"/>
          {/* Lupa */}
          <circle cx="50" cy="50" r="15" fill="#BAE6FD" stroke="#0369A1" strokeWidth="4" fillOpacity="0.8"/>
          {/* Brillo Lupa */}
          <path d="M43 43 A 8 8 0 0 1 50 39" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
          {/* Mango Lupa */}
          <line x1="60" y1="60" x2="75" y2="75" stroke="#B45309" strokeWidth="6" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Cartoon Database */}
      <div 
        className="absolute top-[20%] right-[10%] opacity-20 animate-float"
        style={{ animationDuration: '9s', animationDelay: '1s' }}
      >
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Disco Inferior */}
          <ellipse cx="50" cy="75" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4"/>
          {/* Cuerpo Inferior */}
          <path d="M15 60 V75 A 35 12 0 0 0 85 75 V60 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4"/>
          {/* Disco Medio */}
          <ellipse cx="50" cy="60" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4"/>
          {/* Cuerpo Medio */}
          <path d="M15 45 V60 A 35 12 0 0 0 85 60 V45 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4"/>
          {/* Disco Superior */}
          <ellipse cx="50" cy="45" rx="35" ry="12" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="4"/>
          <path d="M15 30 V45 A 35 12 0 0 0 85 45 V30 Z" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4"/>
          <ellipse cx="50" cy="30" rx="35" ry="12" fill="#C4B5FD" stroke="#4C1D95" strokeWidth="4"/>
          {/* Checkmark verde de seguridad */}
          <circle cx="80" cy="70" r="15" fill="#10B981" stroke="#064E3B" strokeWidth="3"/>
          <path d="M73 70 L78 75 L87 64" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Luces */}
          <circle cx="35" cy="53" r="3" fill="#34D399"/>
          <circle cx="35" cy="68" r="3" fill="#34D399"/>
        </svg>
      </div>

      {/* Cartoon Bug/Hacker */}
      <div 
        className="absolute top-[65%] right-[15%] opacity-15 animate-float"
        style={{ animationDuration: '6s', animationDelay: '3s' }}
      >
        <svg width="90" height="90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Patas Izquierdas */}
          <path d="M40 35 L20 20" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          <path d="M35 50 L15 50" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          <path d="M40 65 L20 80" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          {/* Patas Derechas */}
          <path d="M60 35 L80 20" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          <path d="M65 50 L85 50" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          <path d="M60 65 L80 80" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round"/>
          {/* Cuerpo */}
          <circle cx="50" cy="50" r="25" fill="#EF4444" stroke="#7F1D1D" strokeWidth="4"/>
          {/* Ojos de Hacker */}
          <rect x="35" y="40" width="10" height="8" rx="2" fill="#000000"/>
          <rect x="55" y="40" width="10" height="8" rx="2" fill="#000000"/>
          {/* Rayita brillante Ojos */}
          <circle cx="38" cy="42" r="2" fill="#10B981"/>
          <circle cx="58" cy="42" r="2" fill="#10B981"/>
          {/* Antenas */}
          <path d="M40 25 C35 15 25 15 25 15" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <path d="M60 25 C65 15 75 15 75 15" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
      
      {/* Additional small floating particles (locks/eyes) */}
      <div className="absolute top-[40%] left-[30%] opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      
      <div className="absolute top-[75%] left-[50%] opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </div>
    </div>
  );
}
