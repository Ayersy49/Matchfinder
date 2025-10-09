// app/invites/page.tsx
import InvitesInbox from "./InvitesInbox";

export const metadata = { title: "Davetler" };

export default function InvitesPage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-lg font-semibold">Davetler</h1>
      <InvitesInbox />
    </div>
  );
}
