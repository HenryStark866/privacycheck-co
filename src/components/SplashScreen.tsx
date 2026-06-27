'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('splash_shown')) { setVisible(false); return; }
    sessionStorage.setItem('splash_shown', '1');
    const t1 = setTimeout(() => setFadeOut(true), 2400);
    const t2 = setTimeout(() => setVisible(false), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#020818 0%,#061533 50%,#0a1f4a 100%)',
        transition: fadeOut ? 'opacity 0.5s ease-out' : undefined,
        opacity: fadeOut ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes pcScan{0%{transform:translateY(-100%);opacity:.7}100%{transform:translateY(100vh);opacity:0}}
        @keyframes pcR1{0%,100%{transform:scale(.85);opacity:.6}50%{transform:scale(1.1);opacity:.2}}
        @keyframes pcR2{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.25);opacity:.08}}
        @keyframes pcGlow{0%{opacity:0;transform:scale(.7);filter:blur(8px)}70%{opacity:1;transform:scale(1.04);filter:blur(0)}100%{opacity:1;transform:scale(1)}}
        @keyframes pcTxt{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pcBar{0%{width:0}100%{width:100%}}
        @keyframes pcFlt{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-10px);opacity:1}}
        @keyframes pcGrid{0%{background-position:0 0}100%{background-position:40px 40px}}
        .pc-logo{animation:pcGlow .9s cubic-bezier(.34,1.56,.64,1) .2s both}
        .pc-t1{animation:pcTxt .6s ease-out .9s both}
        .pc-t2{animation:pcTxt .6s ease-out 1.1s both}
        .pc-bw{animation:pcTxt .5s ease-out 1.3s both}
        .pc-bi{animation:pcBar 1.5s cubic-bezier(.4,0,.2,1) 1.4s both}
        .pc-r1{animation:pcR1 3s ease-in-out infinite}
        .pc-r2{animation:pcR2 3s ease-in-out .8s infinite}
        .pc-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,rgba(59,130,246,.7) 30%,rgba(147,197,253,1) 50%,rgba(59,130,246,.7) 70%,transparent 100%);box-shadow:0 0 12px rgba(147,197,253,.9),0 0 30px rgba(59,130,246,.4);animation:pcScan 2.2s linear .4s infinite}
        .pc-grid{background-image:linear-gradient(rgba(59,130,246,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.8) 1px,transparent 1px);background-size:40px 40px;animation:pcGrid 4s linear infinite}
        .pc-dot{position:absolute;border-radius:50%;background:#60a5fa;box-shadow:0 0 8px rgba(96,165,250,.9)}
      `}</style>

      <div className="pc-grid" style={{ position: 'absolute', inset: 0, opacity: 0.04 }} />
      <div className="pc-scan" />

      {/* Partículas */}
      {(['14% _ 11% _ 0s _ 3','22% _ _ 14% _ 0.4s _ 2','72% _ 9% _ _ 0.9s _ 2',
        '78% _ _ 11% _ 0.2s _ 3','44% _ 5% _ _ 0.7s _ 2','58% _ _ 7% _ 1.1s _ 2',
      ]).map((raw, i) => {
        const [top,,l,,r,,d,,s] = raw.split(' _ ');
        const st: React.CSSProperties = { top, animationDuration:`${1.8+i*.25}s`, animationDelay:d, animationName:'pcFlt', animationIterationCount:'infinite', animationTimingFunction:'ease-in-out', width:Number(s), height:Number(s) };
        if (l !== '_') st.left = l; else if (r !== '_') st.right = r;
        return <div key={i} className="pc-dot" style={st} />;
      })}

      {/* Anillos */}
      <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
        <div className="pc-r1" style={{ position:'absolute',width:280,height:280,borderRadius:'50%',border:'1px solid rgba(59,130,246,.25)' }} />
        <div className="pc-r2" style={{ position:'absolute',width:440,height:440,borderRadius:'50%',border:'1px solid rgba(59,130,246,.12)' }} />
        <div style={{ position:'absolute',width:580,height:580,borderRadius:'50%',border:'1px dashed rgba(59,130,246,.06)' }} />
      </div>

      {/* Centro */}
      <div style={{ position:'relative',zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',padding:'0 32px' }}>
        <div className="pc-logo" style={{ position:'relative',marginBottom:24 }}>
          <div style={{ position:'absolute',inset:-20,borderRadius:'50%',background:'rgba(59,130,246,.15)',filter:'blur(20px)' }} />
          <div style={{ position:'relative',width:96,height:96,borderRadius:20,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 40px rgba(59,130,246,.3)' }}>
            <Image src="/logocalvaltac.png" alt="PrivacyCheck CO" width={64} height={64} priority style={{ objectFit:'contain' }} />
          </div>
        </div>

        <h1 className="pc-t1" style={{ fontSize:28,fontWeight:700,color:'#fff',letterSpacing:'-.02em',margin:'0 0 4px' }}>
          Privacy<span style={{ color:'#60a5fa' }}>Check</span> CO
        </h1>
        <p className="pc-t2" style={{ color:'rgba(147,197,253,.65)',fontSize:11,fontWeight:500,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:32 }}>
          Ley 1581 · Autodiagnóstico
        </p>

        <div className="pc-bw" style={{ width:192 }}>
          <div style={{ height:2,background:'rgba(255,255,255,.08)',borderRadius:99,overflow:'hidden' }}>
            <div className="pc-bi" style={{ height:'100%',borderRadius:99,background:'linear-gradient(90deg,#3b82f6,#60a5fa,#93c5fd)',boxShadow:'0 0 10px rgba(96,165,250,.8)' }} />
          </div>
          <p style={{ color:'rgba(96,165,250,.4)',fontSize:9,letterSpacing:'.15em',textTransform:'uppercase',marginTop:8 }}>Iniciando sistema</p>
        </div>
      </div>
    </div>
  );
}
