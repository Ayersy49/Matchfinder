"use client";

import * as React from "react";
import { MapPin, Phone, Star, Check, Navigation, ExternalLink, AlertTriangle } from "lucide-react";

type PitchData = {
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
};

type CustomLocation = {
  lat: number;
  lng: number;
  label: string;
};

type Props = {
  pitch?: PitchData | null;
  customLocation?: CustomLocation | null;
  showDistance?: boolean;
};

export default function PitchInfo({ pitch, customLocation, showDistance = true }: Props) {
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = React.useState<number | null>(null);

  // Kullanıcı konumunu al
  React.useEffect(() => {
    if (!showDistance) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, [showDistance]);

  // Mesafe hesapla
  React.useEffect(() => {
    if (!userLocation) return;
    
    let targetLat: number | undefined;
    let targetLng: number | undefined;
    
    if (pitch) {
      targetLat = pitch.lat;
      targetLng = pitch.lng;
    } else if (customLocation) {
      targetLat = customLocation.lat;
      targetLng = customLocation.lng;
    }
    
    if (targetLat === undefined || targetLng === undefined) return;
    
    // Haversine formula
    const R = 6371;
    const dLat = (targetLat - userLocation.lat) * Math.PI / 180;
    const dLng = (targetLng - userLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = Math.round(R * c * 10) / 10;
    
    setDistance(dist);
  }, [userLocation, pitch, customLocation]);

  // Google Maps link
  const getMapsLink = () => {
    if (pitch) {
      return `https://www.google.com/maps/search/?api=1&query=${pitch.lat},${pitch.lng}`;
    }
    if (customLocation) {
      return `https://www.google.com/maps/search/?api=1&query=${customLocation.lat},${customLocation.lng}`;
    }
    return null;
  };

  // Verification badge
  const VerificationBadge = ({ level }: { level: number }) => {
    if (level >= 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
          <Star className="h-3 w-3" /> İşletme Halı Saha
        </span>
      );
    }
    if (level >= 2) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300 ring-1 ring-blue-500/30">
          <Check className="h-3 w-3" /> Topluluk Onaylı
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-500/30">
        <AlertTriangle className="h-3 w-3" /> Önerilen Saha
      </span>
    );
  };

  // Hiçbir konum yoksa gösterme
  if (!pitch && !customLocation) {
    return null;
  }

  const mapsLink = getMapsLink();

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/80 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-emerald-400" />
        Maç Konumu
      </div>

      {/* Custom Location Warning */}
      {customLocation && !pitch && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Bu konum henüz topluluk tarafından doğrulanmamış özel bir konumdur.
        </div>
      )}

      {/* Pitch Info */}
      {pitch ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{pitch.name}</span>
              </div>
              <VerificationBadge level={pitch.verificationLevel} />
            </div>
            {distance !== null && (
              <div className="rounded-lg bg-emerald-500/20 px-2 py-1 text-sm font-medium text-emerald-300">
                📍 {distance} km
              </div>
            )}
          </div>

          {pitch.address && (
            <p className="text-sm text-neutral-400">{pitch.address}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>{pitch.city}</span>
            {pitch.district && <span>• {pitch.district}</span>}
          </div>

          <div className="flex items-center gap-2 pt-2">
            {pitch.phone && (
              <a
                href={`tel:${pitch.phone}`}
                className="flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
              >
                <Phone className="h-3 w-3" />
                {pitch.phone}
              </a>
            )}
            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
              >
                <ExternalLink className="h-3 w-3" />
                Haritada Aç
              </a>
            )}
          </div>
        </div>
      ) : customLocation ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-medium">{customLocation.label}</span>
              <div className="text-xs text-neutral-500">
                {customLocation.lat.toFixed(5)}, {customLocation.lng.toFixed(5)}
              </div>
            </div>
            {distance !== null && (
              <div className="rounded-lg bg-amber-500/20 px-2 py-1 text-sm font-medium text-amber-300">
                📍 {distance} km
              </div>
            )}
          </div>

          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
            >
              <ExternalLink className="h-3 w-3" />
              Haritada Aç
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
