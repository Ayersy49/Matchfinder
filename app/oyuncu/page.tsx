'use client';
import { useMe } from '@/lib/useMe';

const POS_LABELS: Record<string, string> = {
  GK:'GK', LB:'LB', CB:'CB', RB:'RB', LWB:'LWB', RWB:'RWB',
  DM:'DM', CM:'CM', AM:'AM', LW:'LW', RW:'RW', ST:'ST',
};

export default function OyuncuPage() {
  const { me, loading, error } = useMe();

  if (loading) return <div style={{ padding:24 }}>Yükleniyor…</div>;
  if (error)   return <div style={{ padding:24 }}>❌ {error}</div>;
  if (!me)     return null;

  // sahada göstereceğimiz 3 tercih
  const prefs = Array.isArray(me.positions) ? me.positions.slice(0,3) : [];

  return (
    <div style={{ padding:24, display:'grid', gap:16 }}>
      <h2>Kuşbakışı Saha & Tercihler</h2>

      {/* basit bir saha */}
      <div style={{
        width: 560, height: 320, background:'#0B7A3B', borderRadius:12,
        position:'relative', border:'4px solid #0a5c2c'
      }}>
        {Object.keys(POS_LABELS).map((p, i) => {
          const active = prefs.includes(p);
          // kaba yerleşimler (MVP): pozisyona göre X/Y
          const xy: Record<string, [number,number]> = {
            GK:[30,140], LB:[120,70], CB:[120,140], RB:[120,210],
            LWB:[170,80], RWB:[170,200],
            DM:[240,140], CM:[280,140], AM:[320,140],
            LW:[360,80], RW:[360,200], ST:[420,140],
          };
          const [top,left] = xy[p] ?? [150, 260 + (i*15)%200];
          return (
            <div key={p}
              style={{
                position:'absolute', top, left,
                padding:'4px 8px', borderRadius:999,
                border:'1px solid rgba(255,255,255,.3)',
                background: active ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.25)',
                color:'#E7FFE7', fontSize:12,
              }}>
              {POS_LABELS[p]} {active ? me.level : ''}
            </div>
          );
        })}
      </div>

      <div style={{ opacity:.8 }}>
        <div>Tercihlerim: <b>{prefs.join(', ') || '—'}</b></div>
        <div>Genel seviye: <b>{me.level}</b></div>
        <div style={{ fontSize:12, marginTop:6 }}>
          Not: Şimdilik MVP; gerçek maç sonrası puanlar bu görünüme eklenecek.
        </div>
      </div>
    </div>
  );
}
