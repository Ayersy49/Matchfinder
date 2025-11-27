"use client";

import * as React from "react";
import { MapPin, Phone, Search, Star, Check, X, Navigation } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string {
  try {
    return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
  } catch {
    return "";
  }
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Pitch = {
  id: string;
  name: string;
  city: string;
  district: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  sourceType: string;
  verificationLevel: number;
  distanceKm?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (pitch: Pitch | null, customLocation?: { lat: number; lng: number; label: string }) => void;
  initialCity?: string;
};

export default function PitchSelector({ open, onClose, onSelect, initialCity }: Props) {
  const [mode, setMode] = React.useState<'list' | 'custom'>('list');
  const [cities, setCities] = React.useState<{ name: string; count: number }[]>([]);
  const [selectedCity, setSelectedCity] = React.useState(initialCity || '');
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);

  // Custom location state
  const [customLat, setCustomLat] = React.useState('');
  const [customLng, setCustomLng] = React.useState('');
  const [customLabel, setCustomLabel] = React.useState('');

  // Şehirleri yükle
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/pitches/cities`);
        if (res.ok) {
          const data = await res.json();
          setCities(data.cities || []);
        }
      } catch (e) {
        console.error('Failed to load cities:', e);
      }
    })();
  }, [open]);

  // Kullanıcı konumunu al
  React.useEffect(() => {
    if (!open) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, [open]);

  // Sahaları yükle
  React.useEffect(() => {
    if (!open || !selectedCity) return;
    setLoading(true);
    (async () => {
      try {
        let url = `${API_URL}/pitches?city=${encodeURIComponent(selectedCity)}&limit=50`;
        if (userLocation) {
          url += `&lat=${userLocation.lat}&lng=${userLocation.lng}&radius=50`;
        }
        if (search) {
          url += `&search=${encodeURIComponent(search)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPitches(data.pitches || []);
        }
      } catch (e) {
        console.error('Failed to load pitches:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, selectedCity, search, userLocation]);

  // Verification badge
  const VerificationBadge = ({ level }: { level: number }) => {
    if (level >= 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
          <Star className="h-3 w-3" /> İşletme
        </span>
      );
    }
    if (level >= 2) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300">
          <Check className="h-3 w-3" /> Topluluk Onaylı
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
        Önerilen
      </span>
    );
  };

  const handleSelectPitch = (pitch: Pitch) => {
    onSelect(pitch);
    onClose();
  };

  const handleCustomLocation = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (isNaN(lat) || isNaN(lng) || !customLabel.trim()) {
      alert('Lütfen geçerli koordinatlar ve bir isim girin.');
      return;
    }
    onSelect(null, { lat, lng, label: customLabel.trim() });
    onClose();
  };

  const handleUseCurrentLocation = () => {
    if (userLocation) {
      setCustomLat(userLocation.lat.toFixed(6));
      setCustomLng(userLocation.lng.toFixed(6));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-neutral-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">Saha Seç</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setMode('list')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              mode === 'list' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-neutral-400'
            }`}
          >
            <MapPin className="mr-2 inline h-4 w-4" />
            Doğrulanmış Sahalar
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              mode === 'custom' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-neutral-400'
            }`}
          >
            <Navigation className="mr-2 inline h-4 w-4" />
            Özel Konum
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {mode === 'list' ? (
            <>
              {/* City Selection */}
              {!selectedCity ? (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-neutral-400">Şehir seçin:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {cities.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedCity(c.name)}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-neutral-800 p-3 text-left hover:border-emerald-500/50"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-neutral-500">{c.count} saha</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Back + Search */}
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCity('')}
                      className="rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
                    >
                      ← Geri
                    </button>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Saha ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-neutral-800 py-2 pl-9 pr-3 text-sm"
                      />
                    </div>
                  </div>

                  {/* Pitch List */}
                  {loading ? (
                    <div className="py-8 text-center text-neutral-400">Yükleniyor...</div>
                  ) : pitches.length === 0 ? (
                    <div className="py-8 text-center text-neutral-400">Saha bulunamadı</div>
                  ) : (
                    <div className="space-y-2">
                      {pitches.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPitch(p)}
                          className="w-full rounded-xl border border-white/10 bg-neutral-800/50 p-3 text-left transition hover:border-emerald-500/50 hover:bg-neutral-800"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                <VerificationBadge level={p.verificationLevel} />
                              </div>
                              {p.address && (
                                <p className="mt-1 text-xs text-neutral-400 line-clamp-1">{p.address}</p>
                              )}
                              {p.district && (
                                <p className="text-xs text-neutral-500">{p.district}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {p.distanceKm !== undefined && (
                                <div className="text-sm font-medium text-emerald-400">
                                  {p.distanceKm} km
                                </div>
                              )}
                              {p.phone && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                                  <Phone className="h-3 w-3" />
                                  {p.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Custom Location Mode */
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                ⚠️ Özel konum global saha listesine eklenmez, sadece bu maç için kullanılır.
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-400">Konum Adı</label>
                <input
                  type="text"
                  placeholder="örn: Okul Bahçesi, Park Sahası..."
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Enlem (Lat)</label>
                  <input
                    type="text"
                    placeholder="41.0082"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Boylam (Lng)</label>
                  <input
                    type="text"
                    placeholder="28.9784"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2"
                  />
                </div>
              </div>

              {userLocation && (
                <button
                  onClick={handleUseCurrentLocation}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-neutral-800 py-2 text-sm hover:bg-neutral-700"
                >
                  <Navigation className="h-4 w-4" />
                  Mevcut Konumumu Kullan
                </button>
              )}

              <button
                onClick={handleCustomLocation}
                disabled={!customLabel.trim() || !customLat || !customLng}
                className="w-full rounded-lg bg-amber-600 py-3 font-medium text-black hover:bg-amber-500 disabled:opacity-50"
              >
                Bu Konumu Seç
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
