"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";

export default function AdminTrailers() {
  // ✅ pasá la FunctionReference (archivo.export)
  const games =
    useQuery(api.queries.listGamesWithoutTrailer.listGamesWithoutTrailer, {}) ?? [];

  const save =
    useMutation(api.mutations.setGameTrailerUrl.setGameTrailerUrl);

  const [busy, setBusy] = useState<string | null>(null);
  const [lang, setLang] = useState("es-419");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Asignar trailers (ES-LATAM)</h1>

      <div className="flex items-center gap-2">
        <label className="text-sm opacity-80">Idioma UI YouTube:</label>
        <input className="border rounded px-2 py-1" value={lang} onChange={(e)=>setLang(e.target.value)} />
      </div>

      <ul className="space-y-4">
        {games.map((g: any) => (
          <li key={g._id} className="p-4 rounded-xl border">
            <div className="font-semibold">{g.title}</div>
            <div className="text-xs opacity-70 mb-2">{g.plan.toUpperCase()}</div>
            <TrailerForm
              disabled={busy === String(g._id)}
              onSave={async (url) => {
                setBusy(String(g._id));
                try {
                  await save({ gameId: g._id, url, lang });
                } finally {
                  setBusy(null);
                }
              }}
            />
          </li>
        ))}
      </ul>

      {games.length === 0 && <p className="opacity-70">¡Todos los juegos tienen trailer! 🎉</p>}
    </div>
  );
}

function TrailerForm({
  onSave, disabled,
}: { onSave: (url: string)=>Promise<void>; disabled?: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 border rounded px-3 py-2"
        placeholder="Pega URL de YouTube (español latino) o Vimeo…"
        value={url}
        onChange={(e)=>setUrl(e.target.value)}
        disabled={disabled}
      />
      <button
        onClick={()=> onSave(url).then(()=>setUrl(""))}
        className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        disabled={!url || disabled}
      >
        Guardar
      </button>
    </div>
  );
}
