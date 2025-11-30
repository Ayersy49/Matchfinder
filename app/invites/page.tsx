// app/invites/page.tsx
import AllInvites from "./AllInvites";

export const metadata = { title: "Davetler" };

import { Suspense } from "react";

export default function InvitesPage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <Suspense fallback={<div className="text-white">Yükleniyor...</div>}>
        <AllInvites />
      </Suspense>
    </div>
  );
}
