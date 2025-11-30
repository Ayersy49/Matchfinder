'use client';

import { useEffect } from 'react';
import { useMe } from '@/lib/useMe';
import { requestForToken, onMessageListener } from '@/lib/firebase';
import { authHeader } from '@/lib/auth';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();

  useEffect(() => {
    if (me?.id) {
      // 1. Token al ve backend'e kaydet
      requestForToken().then((token) => {
        if (token) {
          console.log('FCM Token:', token);
          fetch(`${API_URL}/users/me/device-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader(),
            },
            body: JSON.stringify({ token }),
          }).catch(console.error);
        }
      });

      // 2. Ön planda gelen bildirimleri dinle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onMessageListener().then((payload: any) => {
        console.log('Foreground Message:', payload);
        const { title, body } = payload?.notification || {};
        if (title) {
          // Basit bir browser alert veya custom toast gösterilebilir
          // Şimdilik sesli uyarı için basit bir yöntem:
          const audio = new Audio('/notification.mp3'); // Eğer dosya varsa çalar
          audio.play().catch(() => { });

          // Toast yerine şimdilik alert (veya custom UI)
          // alert(`${title}\n${body}`); // Alert çok bloklayıcı olabilir, console'a yazalım
        }
      });
    }
  }, [me?.id]);

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6LfZvBwsAAAAABJtbwt9bi976-VIXsFVf0ZSApIb"
      scriptProps={{
        async: false,
        defer: false,
        appendTo: "head",
        nonce: undefined,
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
