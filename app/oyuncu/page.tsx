/* app/oyuncu/page.tsx */

'use client';

import * as React from 'react';
import { useMe } from '@/lib/useMe';
import { myId } from '@/lib/auth';
import BehaviorRatings from './BehaviorRatings';
import FooterTabs from '@/components/FooterTabs';

/** Saha üstü küçük etiketler için gösterilecek pozisyon isimleri */
const POS_LABELS: Record<string, string> = {
  GK: 'GK',
  LB: 'LB',
  CB: 'CB',
  RB: 'RB',
  LWB: 'LWB',
  RWB: 'RWB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LW: 'LW',
  RW: 'RW',
  ST: 'ST',
};

type Formation = '4-2-3-1' | '4-3-3' | '3-5-2';

/** Her diziliş için sahada kabaca koordinatlar (top,left) */
const XY_4231: Record<string, [number, number]> = {
  GK: [140, 30],
  LB: [70, 120],
  CB: [140, 120],
  RB: [210, 120],
  DM: [140, 240],
  CM: [140, 280],
  AM: [140, 320],
  LW: [80, 360],
  RW: [200, 360],
  ST: [140, 420],
};

const XY_433: Record<string, [number, number]> = {
  GK: [140, 30],
  LB: [70, 120],
  CB: [140, 120],
  RB: [210, 120],
  CM: [90, 260],
  AM: [140, 300],
  DM: [190, 260],
  LW: [80, 360],
  RW: [200, 360],
  ST: [140, 420],
};

const XY_352: Record<string, [number, number]> = {
  GK: [140, 30],
  LWB: [90, 170],
  CB: [140, 120],
  RWB: [190, 170],
  DM: [120, 250],
  CM: [160, 250],
  AM: [140, 300],
  LW: [90, 360],
  RW: [190, 360],
  ST: [140, 420],
};

/** Aktif dizilişe göre kullanılacak koordinat haritası */
function getXY(formation: Formation) {
  if (formation === '3-5-2') return XY_352;
  if (formation === '4-3-3') return XY_433;
  return XY_4231;
}

export default function OyuncuPage() {
  const { me, loading, error } = useMe();
  const [formation, setFormation] = React.useState<Formation>('4-2-3-1');

  if (loading) return <div style={{ padding: 24 }}>Yükleniyor…</div>;
  if (error) return <div style={{ padding: 24 }}>❌ {error}</div>;
  if (!me) return null;
  // profil sayfasında verdiğin seviyeler (yoksa genel seviyeye düş)
  const posMap = (me.positionLevels || {}) as Record<string, number>;
  const valueOf = (p: string) => (posMap[p] ?? me.level);
  const labelOf = (p: string) => (POS_LABELS[p] ?? p);


  // sahada göstereceğimiz 3 tercih
  const prefs: string[] = Array.isArray(me.positions) ? me.positions.slice(0, 3) : [];
  const xy = getXY(formation);
  const visiblePositions = Object.keys(xy); // o dizilişte sahaya konan rozetler

  return (
    <>
      <div
        style={{
          padding: 24,
          paddingBottom: 96, // alt barda içerik altında kalmasın
          display: 'grid',
          gap: 16,
          gridTemplateColumns: '1fr',
        }}
      >
        {/* başlık + diziliş butonları */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>Kuşbakışı Saha & Tercihler</h2>

          <div style={{ display: 'flex', gap: 8 }}>
            {(['4-2-3-1', '4-3-3', '3-5-2'] as Formation[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                style={{
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.15)',
                  background: formation === f ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)',
                  color: '#E7FFE7',
                  fontSize: 13,
                  padding: '6px 10px',
                }}
                title="Dizilişi değiştir"
              >
                {f}
              </button>
            ))}
            <a
              href="#ratings"
              style={{
                marginLeft: 8,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.06)',
                color: '#E7FFE7',
                fontSize: 13,
                padding: '6px 10px',
                textDecoration: 'none',
              }}
              title="Davranış değerlendirmesine git"
            >
              ↓ Değerlendir
            </a>
          </div>
        </div>

        {/* üst bölüm: saha + sağda özet */}
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(300px,560px) minmax(240px,1fr)',
            alignItems: 'start',
          }}
        >
          {/* Saha */}
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              height: 320,
              background: '#0B7A3B',
              borderRadius: 12,
              position: 'relative',
              border: '4px solid #0a5c2c',
              overflow: 'hidden',
            }}
          >
            {/* çizgi efekti */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 2,
                background: 'rgba(255,255,255,.18)',
                transform: 'translateX(-1px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                right: 8,
                bottom: 8,
                border: '2px solid rgba(255,255,255,.18)',
                borderRadius: 10,
              }}
            />

            {/* rozetler */}
            {visiblePositions.map((p, i) => {
              const active = prefs.includes(p);
              const [top, left] = xy[p] ?? [140, 260 + ((i * 15) % 200)];
              return (
                <div
                  key={p}
                  style={{
                    position: 'absolute',
                    top,
                    left,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,.3)',
                    background: active ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.25)',
                    color: active ? '#A7F3D0' : '#E7FFE7',
                    fontSize: 12,
                    userSelect: 'none',
                  }}
                  title={active ? 'Tercihlerinden biri' : 'Bilgilendirme'}
                >
                  {POS_LABELS[p]} {active ? valueOf(p) : ''}
                </div>
              );
            })}
          </div>

          {/* sağ özet */}
          <div
            style={{
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(17,24,39,.6)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ opacity: 0.9, marginBottom: 8 }}>
              <div>
                Tercihlerim:{' '}
                <b>
                  {prefs.length
                    ? prefs.map((p, i) => `${i + 1}. ${labelOf(p)} • ${valueOf(p)}`).join('   ')
                    : '—'}
                </b>
              </div>
              <div>
                Genel seviye: <b>{me.level ?? '—'}</b>
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                opacity: 0.7,
                lineHeight: 1.5,
                borderTop: '1px dashed rgba(255,255,255,.12)',
                paddingTop: 8,
              }}
            >
              <div>• Dizilişi değiştirerek sahadaki yerleşimlerin nasıl değiştiğini görebilirsin.</div>
              <div>• Etiketlerde yeşil görünenler senin ilk 3 tercihindir.</div>
            </div>
          </div>
        </div>

        {/* Davranış / Rating kartı */}
        <div id="ratings">
          <BehaviorRatings
            targetUserId={me.id ?? myId() ?? 'me'}
            // defaultValues={{ punctuality: 4, respect: 4, fairplay: 4, profanity: 2, aggression: 2 }}
            // matchId={new URLSearchParams(location.search).get('matchId') ?? undefined}
          />
        </div>
      </div>

      {/* 🔻 alt tab bar */}
      <FooterTabs active="player" />
    </>
  );
}
