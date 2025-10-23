// app/match/[id]/page.tsx
import React from "react";
import MatchDetailClient from "./MatchDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 14: params artık Promise -> await et
  const { id } = await params;
  return <MatchDetailClient id={id} />;
}
