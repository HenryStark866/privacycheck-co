'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  // Empieza en false — el servidor NUNCA renderiza el splash
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);

  useEffect(() => {
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
          0%   { top:-2px; opacity:.6; }
          100% { top:100%; opacity:0;  }
        }
        @keyframes pcPulse {
          0%,100% { transform:scale(1);    opacity:.3; }
          50%     { transform:scale(1.14); opacity:.6; }
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
          background:linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
          transition:opacity .45s ease-out;
        }
        .pc-wrap.exit { opacity:0; pointer-events:none; }
        .pc-grid {
          position:absolute; inset:0; opacity:.04;
          background-image:
            linear-gradient(rgba(15,118,110,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,118,110,1) 1px, transparent 1px);
          background-size:44px 44px;
        }
        .pc-scan {
          position:absolute; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(20,184,166,.7) 40%,rgba(45,212,191,1) 50%,rgba(20,184,166,.7) 60%,transparent);
          box-shadow:0 0 12px rgba(20,184,166,.5);
          animation:pcScan 1.8s linear infinite;
        }
        .pc-ring {
          position:absolute; border-radius:50%;
          border:1px solid rgba(20,184,166,.15);
          animation:pcPulse 3s ease-in-out infinite;
        }
        .pc-content { animation:pcIn .7s cubic-bezier(.34,1.56,.64,1) .1s both; }
        .pc-box {
          position:relative; width:88px; height:88px; border-radius:22px;
          background:#ffffff; border:1px solid rgba(20,184,166,.25);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 8px 32px rgba(20,184,166,.15), 0 2px 8px rgba(0,0,0,.06); margin-bottom:20px;
        }
        .pc-glow {
          position:absolute; inset:-16px; border-radius:50%;
          background:radial-gradient(circle,rgba(20,184,166,.12),transparent 70%);
          filter:blur(12px);
        }
        .pc-logo { width:58px; height:58px; object-fit:contain; position:relative; z-index:1; }
        .pc-title { font-size:26px; font-weight:700; color:#0f172a; letter-spacing:-.02em; margin:0 0 4px; }
        .pc-title span { color:#0d9488; }
        .pc-sub { font-size:10px; font-weight:600; color:#64748b; letter-spacing:.18em; text-transform:uppercase; margin-bottom:28px; }
        .pc-track { width:160px; height:2px; background:#e2e8f0; border-radius:99px; overflow:hidden; }
        .pc-fill  { height:100%; background:linear-gradient(90deg,#14b8a6,#2dd4bf,#5eead4); border-radius:99px;
                    box-shadow:0 0 8px rgba(20,184,166,.4); animation:pcBar 1.6s cubic-bezier(.4,0,.2,1) .15s both; }
        .pc-label { font-size:9px; color:#94a3b8; letter-spacing:.15em; text-transform:uppercase; margin-top:8px; }
      `}</style>

      <div className={`pc-wrap${exit ? ' exit' : ''}`}>
        <div className="pc-grid" />
        <div className="pc-scan" />
        <div className="pc-ring" style={{ width:260, height:260 }} />
        <div className="pc-ring" style={{ width:420, height:420, animationDelay:'.8s', opacity:.5 }} />

        <div className="pc-content" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
          <div className="pc-box">
            <div className="pc-glow" />
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
