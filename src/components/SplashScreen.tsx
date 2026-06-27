'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  // Empieza en false — el servidor NUNCA renderiza el splash
  // Solo el cliente lo activa, garantizando que useEffect siempre corre
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);

  useEffect(() => {
    // Solo mostrar una vez por sesión de navegador
    if (sessionStorage.getItem('pc_splash')) return;
    sessionStorage.setItem('pc_splash', '1');

    setShow(true);
    const t1 = setTimeout(() => setExit(true), 1800);
    const t2 = setTimeout(() => setShow(false), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes pcScan {
          0%   { top:-2px; opacity:.8; }
          100% { top:100%; opacity:0;  }
        }
        @keyframes pcPulse {
          0%,100% { transform:scale(1);    opacity:.45; }
          50%     { transform:scale(1.14); opacity:.85; }
        }
        @keyframes pcIn {
          from { opacity:0; transform:translateY(18px) scale(.94); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes pcBar {
          from { width:0;    }
          to   { width:100%; }
        }
        .pc-wrap {
          position:fixed; inset:0; z-index:9999;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:linear-gradient(135deg,#030d1f 0%,#071e45 60%,#0c2a5e 100%);
          transition:opacity .45s ease-out;
        }
        .pc-wrap.exit { opacity:0; pointer-events:none; }
        .pc-grid {
          position:absolute; inset:0; opacity:.035;
          background-image:
            linear-gradient(rgba(59,130,246,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px);
          background-size:44px 44px;
        }
        .pc-scan {
          position:absolute; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent,rgba(96,165,250,.9) 40%,#bfdbfe 50%,rgba(96,165,250,.9) 60%,transparent);
          box-shadow:0 0 14px rgba(147,197,253,.9);
          animation:pcScan 1.8s linear infinite;
        }
        .pc-ring {
          position:absolute; border-radius:50%;
          border:1px solid rgba(59,130,246,.2);
          animation:pcPulse 3s ease-in-out infinite;
        }
        .pc-content { animation:pcIn .7s cubic-bezier(.34,1.56,.64,1) .1s both; }
        .pc-box {
          position:relative; width:88px; height:88px; border-radius:20px;
          background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 40px rgba(59,130,246,.35); margin-bottom:20px;
        }
        .pc-glow {
          position:absolute; inset:-16px; border-radius:50%;
          background:radial-gradient(circle,rgba(59,130,246,.25),transparent 70%);
          filter:blur(12px);
        }
        .pc-logo { width:60px; height:60px; object-fit:contain; position:relative; z-index:1; }
        .pc-title { font-size:26px; font-weight:700; color:#fff; letter-spacing:-.02em; margin:0 0 4px; }
        .pc-title span { color:#60a5fa; }
        .pc-sub { font-size:10px; font-weight:500; color:rgba(147,197,253,.6); letter-spacing:.18em; text-transform:uppercase; margin-bottom:28px; }
        .pc-track { width:160px; height:2px; background:rgba(255,255,255,.08); border-radius:99px; overflow:hidden; }
        .pc-fill  { height:100%; background:linear-gradient(90deg,#3b82f6,#60a5fa,#93c5fd); border-radius:99px;
                    box-shadow:0 0 10px rgba(96,165,250,.8); animation:pcBar 1.6s cubic-bezier(.4,0,.2,1) .15s both; }
        .pc-label { font-size:9px; color:rgba(96,165,250,.4); letter-spacing:.15em; text-transform:uppercase; margin-top:8px; }
      `}</style>

      <div className={`pc-wrap${exit ? ' exit' : ''}`}>
        <div className="pc-grid" />
        <div className="pc-scan" />
        <div className="pc-ring" style={{ width:260, height:260 }} />
        <div className="pc-ring" style={{ width:420, height:420, animationDelay:'.8s', opacity:.5 }} />

        <div className="pc-content" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
          <div className="pc-box">
            <div className="pc-glow" />
            {/* Usar img nativo para evitar problemas con Next.js Image en contextos fixed */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-cavaltec.png" alt="PrivacyCheck CO" className="pc-logo" />
          </div>

          <h1 className="pc-title">Privacy<span>Check</span> CO</h1>
          <p className="pc-sub">Ley 1581 · Autodiagnóstico</p>

          <div className="pc-track">
            <div className="pc-fill" />
          </div>
          <p className="pc-label">Iniciando sistema</p>
        </div>
      </div>
    </>
  );
}
