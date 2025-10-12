import React from "react";
import MatchDetailClient from "./MatchDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchDetailClient id={id} />;
}
