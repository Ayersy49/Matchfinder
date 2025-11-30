"use client";

import React, { useState, useEffect } from "react";
import { LogIn, Footprints, ArrowLeft, Eye, EyeOff, Check, X, User, Lock, Phone } from "lucide-react";
import { setToken } from "@/lib/auth";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type AuthStep = "choice" | "otp" | "set-credentials" | "password-login";

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  // Arka plan görselleri
  const STADIUMS = [
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1486286701208-1d58e9338013?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1600&auto=format&fit=crop",
  ];

  const [bgIdx, setBgIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBgIdx((i) => (i + 1) % STADIUMS.length), 4500);
    return () => clearInterval(id);
  }, []);

  // Auth state
  const [step, setStep] = useState<AuthStep>("choice");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Set credentials state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Password login state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helpers
  const normalizePhone = (s: string) => s.replace(/\D/g, "");
  const normalizeCode = (s: string) => s.replace(/\D/g, "").slice(0, 6);

  // Username availability check (debounced)
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const r = await fetch(`${API_URL}/auth/check-username?username=${encodeURIComponent(username)}`);
        const data = await r.json();
        setUsernameAvailable(data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  /* ================== OTP FLOW ================== */

  async function requestOtp() {
    if (!phone || normalizePhone(phone).length < 10) {
      setError("Geçerli bir telefon numarası girin");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let token = "";
      if (executeRecaptcha) {
        token = await executeRecaptcha("otp_request");
      }

      const r = await fetch(`${API_URL}/auth/otp/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-recaptcha-token": token,
        },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const data = await r.json();

      // Dev modda OTP'yi göster
      const shown = data?.devCode ?? data?.code;
      if (shown) alert("DEV OTP: " + shown);

      if (!data?.ok) {
        setError("OTP gönderilemedi");
      }
    } catch (err) {
      console.error(err);
      setError("OTP isteği başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpCode || otpCode.length < 4) {
      setError("OTP kodunu girin");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          code: normalizeCode(otpCode),
        }),
      });
      const data = await r.json();

      if (!data?.ok || !data?.accessToken) {
        if (data?.statusCode === 403) {
          const msg = typeof data.message === 'object' && data.message !== null
            ? (data.message as any).message
            : data.message;
          setError(msg || "Erişim reddedildi.");
          return;
        }
        if (data?.reason === 'banned') {
          setError(data.message || 'Hesabınız yasaklanmıştır.');
          return;
        }
        const msg =
          data?.reason === "OTP_expired"
            ? "Kodun süresi doldu"
            : data?.reason === "OTP_mismatch"
              ? "Kod hatalı"
              : "Doğrulama başarısız";
        setError(msg);
        return;
      }

      // OTP başarılı - kullanıcı durumuna göre yönlendir
      if (data.hasPassword) {
        // Kullanıcının şifresi var -> direkt giriş yap
        setToken(data.accessToken);
        onSuccess();
      } else {
        // Yeni kullanıcı veya şifresi yok -> credentials belirleme ekranına git
        setTempToken(data.accessToken);
        setStep("set-credentials");
      }
    } catch {
      setError("Doğrulama sırasında hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  /* ================== SET CREDENTIALS ================== */

  async function submitCredentials() {
    // Validasyonlar
    if (!username || username.length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalı");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Kullanıcı adı sadece harf, rakam ve _ içerebilir");
      return;
    }
    if (!password || password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (usernameAvailable === false) {
      setError("Bu kullanıcı adı zaten alınmış");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/auth/set-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempToken}`,
        },
        body: JSON.stringify({
          username,
          password,
          passwordConfirm,
        }),
      });
      const data = await r.json();

      if (!data?.ok) {
        setError(data?.message || "Hesap oluşturulamadı");
        return;
      }

      // Başarılı - yeni token'ı kaydet
      setToken(data.accessToken || tempToken);
      onSuccess();
    } catch {
      setError("Hesap oluşturulurken hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  /* ================== PASSWORD LOGIN ================== */

  async function loginWithPassword() {
    if (!loginIdentifier) {
      setError("Telefon veya kullanıcı adı girin");
      return;
    }
    if (!loginPassword) {
      setError("Şifrenizi girin");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier,
          password: loginPassword,
        }),
      });
      const data = await r.json();

      if (!data?.ok) {
        if (data?.statusCode === 403) {
          const msg = typeof data.message === 'object' && data.message !== null
            ? (data.message as any).message
            : data.message;
          setError(msg || "Erişim reddedildi.");
        } else if (data?.reason === "no_password") {
          setError("Bu hesapta şifre tanımlı değil. OTP ile giriş yapın.");
        } else if (data?.reason === 'banned') {
          setError(data.message || 'Hesabınız yasaklanmıştır.');
        } else {
          setError("Kullanıcı adı/telefon veya şifre hatalı");
        }
        return;
      }

      setToken(data.accessToken);
      onSuccess();
    } catch {
      setError("Giriş sırasında hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  /* ================== RENDER ================== */

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Background slides */}
      <div className="absolute inset-0">
        {STADIUMS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="stadium"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${i === bgIdx ? "opacity-100" : "opacity-0"
              }`}
          />
        ))}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 text-3xl font-semibold">
            <Footprints className="size-8" />
            <span>MatchFinder</span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">Bölge + Pozisyon + Seviye ile maça katıl</p>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900/70 backdrop-blur p-5 shadow-xl ring-1 ring-white/10">
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ===== STEP: CHOICE ===== */}
          {step === "choice" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Giriş Yap</h2>
                <p className="text-sm text-neutral-400 mt-1">Nasıl giriş yapmak istersiniz?</p>
              </div>

              <button
                onClick={() => setStep("otp")}
                className="flex w-full items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-500 transition"
              >
                <Phone className="size-5" />
                <span>Telefon ile Giriş (OTP)</span>
              </button>

              <button
                onClick={() => setStep("password-login")}
                className="flex w-full items-center gap-3 rounded-xl border border-white/20 px-4 py-3 font-medium hover:bg-white/5 transition"
              >
                <Lock className="size-5" />
                <span>Şifre ile Giriş</span>
              </button>

              <p className="text-xs text-neutral-400 text-center mt-4">
                İlk kez mi giriyorsunuz? Telefon ile giriş yapın ve hesabınızı oluşturun.
              </p>
            </div>
          )}

          {/* ===== STEP: OTP ===== */}
          {step === "otp" && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep("choice"); setError(null); }}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
              >
                <ArrowLeft className="size-4" /> Geri
              </button>

              <div>
                <label className="block text-sm text-neutral-300 mb-1">Telefon Numarası</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5xx xxx xx xx"
                  className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                  inputMode="tel"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300 mb-1">OTP Kodu</label>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(normalizeCode(e.target.value))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded-xl bg-neutral-800 px-4 py-3 tracking-widest outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                  inputMode="numeric"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={requestOtp}
                  disabled={loading}
                  className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5 disabled:opacity-50 transition"
                >
                  Kod Gönder
                </button>

                <button
                  onClick={verifyOtp}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-50 transition"
                >
                  <LogIn className="size-5" />
                  {loading ? "Doğrulanıyor..." : "Doğrula"}
                </button>
              </div>

              <p className="text-xs text-neutral-400">
                Giriş ile <a className="underline cursor-pointer">KVKK Aydınlatma</a> ve{" "}
                <a className="underline cursor-pointer">Kullanım Koşulları</a>nı kabul edersiniz.
              </p>
            </div>
          )}

          {/* ===== STEP: SET CREDENTIALS ===== */}
          {step === "set-credentials" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold">Hesap Oluştur</h2>
                <p className="text-sm text-neutral-400 mt-1">
                  Kullanıcı adı ve şifre belirleyin
                </p>
              </div>

              {/* Phone (readonly) */}
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Telefon Numarası</label>
                <input
                  value={phone}
                  readOnly
                  className="w-full rounded-xl bg-neutral-700 px-4 py-3 outline-none ring-1 ring-white/10 text-neutral-400 cursor-not-allowed"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Kullanıcı Adı</label>
                <div className="relative">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="kullanici_adi"
                    maxLength={24}
                    className="w-full rounded-xl bg-neutral-800 px-4 py-3 pr-10 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                  />
                  {username.length >= 3 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername ? (
                        <span className="text-neutral-500 text-xs">...</span>
                      ) : usernameAvailable ? (
                        <Check className="size-5 text-emerald-400" />
                      ) : (
                        <X className="size-5 text-red-400" />
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  3-24 karakter, sadece harf, rakam ve _ kullanılabilir
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full rounded-xl bg-neutral-800 px-4 py-3 pr-10 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Password Confirm */}
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Şifre (Tekrar)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Şifrenizi tekrar girin"
                    className="w-full rounded-xl bg-neutral-800 px-4 py-3 pr-10 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                  />
                  {passwordConfirm && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {password === passwordConfirm ? (
                        <Check className="size-5 text-emerald-400" />
                      ) : (
                        <X className="size-5 text-red-400" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={submitCredentials}
                disabled={loading || !username || !password || !passwordConfirm || usernameAvailable === false}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                <User className="size-5" />
                {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
              </button>
            </div>
          )}

          {/* ===== STEP: PASSWORD LOGIN ===== */}
          {step === "password-login" && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep("choice"); setError(null); }}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
              >
                <ArrowLeft className="size-4" /> Geri
              </button>

              <div>
                <label className="block text-sm text-neutral-300 mb-1">
                  Telefon veya Kullanıcı Adı
                </label>
                <input
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="5xxxxxxxxx veya kullanici_adi"
                  className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300 mb-1">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Şifreniz"
                    className="w-full rounded-xl bg-neutral-800 px-4 py-3 pr-10 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                    onKeyDown={(e) => e.key === "Enter" && loginWithPassword()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={loginWithPassword}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                <LogIn className="size-5" />
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>

              <div className="text-center">
                <button
                  onClick={() => setStep("otp")}
                  className="text-sm text-emerald-400 hover:underline"
                >
                  Şifremi unuttum / OTP ile giriş
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
