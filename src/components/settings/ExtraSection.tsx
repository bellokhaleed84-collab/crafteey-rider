"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsPageShell from "@/components/settings/SettingsPageShell";
import RichBlocks from "@/components/settings/RichBlocks";
import { parseSections } from "@/lib/richText";

type Extra = { slug: string; title: string; body: string };

export default function ExtraSection({ slug }: { slug: string }) {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<"loading" | "missing" | Extra>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/rider-content/sections", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const d = await res.json().catch(() => ({}));
        const found = res.ok && Array.isArray(d.sections) ? (d.sections as Extra[]).find((s) => s.slug === slug) : null;
        if (!cancelled) setState(found ?? "missing");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken, slug]);

  if (state === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-brand">Not found</h1>
        <p className="text-sm text-steel">This settings page doesn't exist.</p>
      </div>
    );
  }

  const sections = parseSections(state.body);
  return (
    <SettingsPageShell title={state.title}>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        {sections.map((s, i) => (
          <div key={i} className="space-y-2">
            {s.title && <p className="text-sm font-bold text-brand">{s.title}</p>}
            <RichBlocks blocks={s.blocks} />
          </div>
        ))}
      </div>
    </SettingsPageShell>
  );
}