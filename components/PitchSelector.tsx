"use client";

import * as React from "react";
import { MapPin, Phone, Search, Star, Check, X, Navigation, ChevronDown } from "lucide-react";

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

// Türkiye'nin büyük şehirleri (API'den veri gelmezse fallback)
const TURKEY_CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", 
  "Adana", "Konya", "Gaziantep", "Mersin", "Kayseri",
  "Eskişehir", "Samsun", "Denizli", "Sakarya", "Kocaeli"
];

export default function PitchSelector({ open, onClose, onSelect, initialCity }: Props) {
  const [mode, setMode] = React.useState<'list' | 'custom'>('list');
  const [cities, setCities] = React.useState<{ name: string; count: number }[]>([]);
  const [selectedCity, setSelectedCity] = React.useState(initialCity || '');
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingCities, setLoadingCities] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [cityDropdownOpen, setCityDropdownOpen] = React.useState(false);

  // Custom location state - basitleştirilmiş
  const [customName, setCustomName] = React.useState('');
  const [customDistrict, setCustomDistrict] = React.useState('');
  const [customCity, setCustomCity] = React.useState('');

  // Şehirleri yükle
  React.useEffect(() => {
    if (!open) return;
    setLoadingCities(true);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/pitches/cities`, { headers: authHeader() });
        if (res.ok) {
          const data = await res.json();
          if (data.cities && data.cities.length > 0) {
            setCities(data.cities);
          } else {
            // API'den veri gelmediyse fallback kullan
            setCities(TURKEY_CITIES.map(c => ({ name: c, count: 0 })));
          }
        } else {
          setCities(TURKEY_CITIES.map(c => ({ name: c, count: 0 })));
        }
      } catch (e) {
        console.error('Failed to load cities:', e);
        setCities(TURKEY_CITIES.map(c => ({ name: c, count: 0 })));
      } finally {
        setLoadingCities(false);
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
    if (!open || !selectedCity) {
      setPitches([]);
      return;
    }
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
        const res = await fetch(url, { headers: authHeader() });
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
    if (!customName.trim()) {
      alert('Lütfen saha adını girin.');
      return;
    }
    
    // Koordinat olmadan, sadece label oluştur
    // Harita gösterimi olmayacak ama maç kaydedilebilir
    const label = [customName.trim(), customDistrict.trim(), customCity.trim()]
      .filter(Boolean)
      .join(', ');
    
    // Default olarak Türkiye merkezi (harita gösterilmeyecek zaten)
    onSelect(null, { lat: 39.9334, lng: 32.8597, label });
    onClose();
  };

  // Modal kapatıldığında state'leri sıfırla
  React.useEffect(() => {
    if (!open) {
      setSelectedCity('');
      setSearch('');
      setCustomName('');
      setCustomDistrict('');
      setCustomCity('');
      setCityDropdownOpen(false);
    }
  }, [open]);

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
            Kayıtlı Sahalar
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              mode === 'custom' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-neutral-400'
            }`}
          >
            <Navigation className="mr-2 inline h-4 w-4" />
            Manuel Giriş
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'list' ? (
            <>
              {/* City Selection Dropdown */}
              <div className="mb-4">
                <label className="mb-2 block text-sm text-neutral-400">Şehir seçin:</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-neutral-800 px-4 py-3 text-left hover:border-white/20"
                  >
                    <span className={selectedCity ? 'text-white' : 'text-neutral-500'}>
                      {selectedCity || 'Şehir seçin...'}
                    </span>
                    <ChevronDown className={`h-5 w-5 text-neutral-400 transition ${cityDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {cityDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-neutral-800 shadow-xl">
                      {loadingCities ? (
                        <div className="p-4 text-center text-neutral-400">Yükleniyor...</div>
                      ) : cities.length === 0 ? (
                        <div className="p-4 text-center text-neutral-400">Şehir bulunamadı</div>
                      ) : (
                        cities.map((c) => (
                          <button
                            key={c.name}
                            onClick={() => {
                              setSelectedCity(c.name);
                              setCityDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-700 ${
                              selectedCity === c.name ? 'bg-emerald-500/20 text-emerald-400' : ''
                            }`}
                          >
                            <span>{c.name}</span>
                            {c.count > 0 && (
                              <span className="text-xs text-neutral-500">{c.count} saha</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Search & Pitch List (only if city selected) */}
              {selectedCity && (
                <div className="max-h-[40vh] overflow-y-auto">
                  {/* Search */}
                  <div className="relative mb-3 sticky top-0 bg-neutral-900 pb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Saha ara..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-neutral-800 py-2 pl-9 pr-3 text-sm"
                    />
                  </div>

                  {/* Pitch List */}
                  {loading ? (
                    <div className="py-8 text-center text-neutral-400">Yükleniyor...</div>
                  ) : pitches.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-neutral-400">Bu şehirde kayıtlı saha bulunamadı.</p>
                      <p className="mt-2 text-sm text-neutral-500">
                        "Manuel Giriş" sekmesinden saha bilgilerini girebilirsiniz.
                      </p>
                    </div>
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
                                  {p.distanceKm.toFixed(1)} km
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
                </div>
              )}

              {/* Hint when no city selected */}
              {!selectedCity && !loadingCities && (
                <div className="py-4 text-center text-sm text-neutral-500">
                  Sahaları görmek için yukarıdan şehir seçin
                </div>
              )}
            </>
          ) : (
            /* Custom Location Mode - Sadeleştirilmiş */
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                ⚠️ Manuel girilen konum sadece bu maç için geçerlidir.
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-400">
                  Saha Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="örn: Yıldız Halı Saha"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-400">İlçe</label>
                <input
                  type="text"
                  placeholder="örn: Kadıköy"
                  value={customDistrict}
                  onChange={(e) => setCustomDistrict(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-400">Şehir</label>
                <input
                  type="text"
                  placeholder="örn: İstanbul"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-3"
                />
              </div>

              <button
                onClick={handleCustomLocation}
                disabled={!customName.trim()}
                className="w-full rounded-lg bg-amber-600 py-3 font-medium text-black hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bu Sahayı Kullan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
