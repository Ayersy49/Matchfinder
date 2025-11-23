// app/invites/page.tsx
import AllInvites from "./AllInvites";

export const metadata = { title: "Davetler" };

export default function InvitesPage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <AllInvites />
    </div>
  );
}
