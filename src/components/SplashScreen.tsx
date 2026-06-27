'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Solo mostrar en primera visita de la sesión
    if (sessionStorage.getItem('splash_shown')) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem('splash_shown', '1');

    const timer = setTimeout(() => setFadeOut(true), 2400);
    const timer2 = setTimeout(() => setVisible(false), 2900);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #020818 0%, #061533 50%, #0a1f4a 100%)',
        transition: fadeOut ? 'opacity 0.5s ease-out' : undefined,
        opacity: fadeOut ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0.6; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes ring-pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
        @keyframes ring-pulse2 {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.1; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        @keyframes glow-in {
          0% { opacity: 0; transform: scale(0.7) translateY(8px); filter: blur(8px); }
          60% { opacity: 1; transform: scale(1.05) translateY(0); filter: blur(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes text-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-fill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-12px) scale(1.3); opacity: 1; }
        }
        @keyframes grid-move {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        .splash-logo { animation: glow-in 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }
        .splash-title { animation: text-in 0.6s ease-out 0.9s both; }
        .splash-sub { animation: text-in 0.6s ease-out 1.1s both; }
        .splash-bar { animation: text-in 0.4s ease-out 1.3s both; }
        .bar-inner { animation: bar-fill 1.5s cubic-bezier(0.4,0,0.2,1) 1.4s both; }
        .scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.8) 30%, rgba(99,179,255,1) 50%, rgba(59,130,246,0.8) 70%, transparent 100%);
          animation: scan 2s linear 0.5s infinite;
          box-shadow: 0 0 12px rgba(99,179,255,0.8), 0 0 30px rgba(59,130,246,0.4);
        }
        .ring1 { animation: ring-pulse 3s ease-in-out infinite; }
        .ring2 { animation: ring-pulse2 3s ease-in-out 1s infinite; }
        .grid-bg { animation: grid-move 4s linear infinite; }
      `}</style>

      {/* Grid animado */}
      <div
        className="absolute inset-0 opacity-[0.04] grid-bg"
        style={{backgroundImage:'linear-gradient(rgba(59,130,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,1) 1px,transparent 1px)',backgroundSize:'40px 40px'}}
      />

      {/* Scan line */}
      <div className="scan-line" />

      {/* Partículas decorativas */}
      {[
        {top:'15%',left:'12%',delay:'0s',size:'3px'},{top:'25%',right:'15%',delay:'0.5s',size:'2px'},
        {top:'70%',left:'8%',delay:'1s',size:'2px'},{top:'80%',right:'10%',delay:'0.3s',size:'3px'},
        {top:'45%',left:'5%',delay:'0.8s',size:'2px'},{top:'55%',right:'6%',delay:'1.2s',size:'2px'},
        {top:'35%',left:'20%',delay:'0.2s',size:'2px'},{top:'65%',right:'22%',delay:'0.7s',size:'3px'},
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-blue-400"
          style={{
            top:p.top, left:(p as any).left, right:(p as any).right,
            width:p.size, height:p.size,
            animation:`particle-float ${2+i*0.3}s ease-in-out ${p.delay} infinite`,
            boxShadow:`0 0 6px rgba(96,165,250,0.8)`,
          }}
        />
      ))}

      {/* Anillos de fondo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="ring1 absolute w-[300px] h-[300px] rounded-full border border-blue-500/20" />
        <div className="ring2 absolute w-[460px] h-[460px] rounded-full border border-blue-400/10" />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-blue-300/05" style={{borderStyle:'dashed'}} />
      </div>

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center text-center px-8">

        {/* Logo con glow */}
        <div className="splash-logo relative mb-6">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl scale-150" />
          <div className="relative w-24 h-24 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
            <Image
              src="/logocalvaltac.png"
              alt="PrivacyCheck CO"
              width={80}
              height={80}
              className="w-16 h-16 object-contain"
              priority
            />
          </div>
          {/* Esquinas tech */}
          {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos,i) => (
            <div key={i} className={`absolute ${pos} w-3 h-3`}>
              <div className={`absolute ${i<2?'top-0':'bottom-0'} ${i%2===0?'left-0':'right-0'} w-px h-3 bg-blue-400/60`} />
              <div className={`absolute ${i<2?'top-0':'bottom-0'} ${i%2===0?'left-0':'right-0'} h-px w-3 bg-blue-400/60`} />
            </div>
          ))}
        </div>

        <h1 className="splash-title text-3xl font-bold text-white tracking-tight mb-1">
          Privacy<span className="text-blue-400">Check</span> CO
        </h1>
        <p className="splash-sub text-blue-300/70 text-sm font-medium tracking-widest uppercase mb-8">
          Ley 1581 · Autodiagnóstico
        </p>

        {/* Barra de carga */}
        <div className="splash-bar w-48">
          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="bar-inner h-full rounded-full"
              style={{background:'linear-gradient(90deg,#3b82f6,#60a5fa,#93c5fd)',boxShadow:'0 0 8px rgba(96,165,250,0.8)'}}
            />
          </div>
          <p className="text-blue-400/50 text-[10px] tracking-widest uppercase mt-2">
            Iniciando sistema
          </p>
        </div>
      </div>
    </div>
  );
}
