// app/match/[id]/page.tsx  (SERVER component – burada "use client" YOK)
import React from "react";
import MatchDetailClient from "./MatchDetailClient";

export default function Page(props: { params: { id: string } }) {
  // Not: Next 15 burada "params bir Promise olacak" diye uyarı veriyor olabilir;
  // şu hali çalışır. Çok takıntı yaparsan:
  // const { id } = React.use(props.params);
  // şeklinde de kullanabilirsin. (Şimdilik gerek yok.)
  const id = props.params.id;
  return <MatchDetailClient id={id} />;
}
