// playverse-web/app/admin/edit-game/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { ChevronLeft, ChevronRight, ArrowLeft, Play } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

type MediaItem = { type: "image" | "video"; src: string; thumb?: string };

function toEmbed(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?rel=0&modestbranding=1`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

export default function AdminEditGamePage() {
  const params = useParams() as { id?: string | string[] } | null;
  const router = useRouter();
  const gameId = Array.isArray(params?.id) ? params!.id![0] : (params?.id as string | undefined);
  const hasId = Boolean(gameId);
  const { toast } = useToast();

  const game = useQuery(
    api.queries.getGameById.getGameById as any,
    hasId ? ({ id: gameId as Id<"games"> } as any) : "skip"
  ) as Doc<"games"> | null | undefined;

  // IGDB screenshots
  const fetchShots = useAction(api.actions.getIGDBScreenshots.getIGDBScreenshots as any);
  const [igdbUrls, setIgdbUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!game?.title) return;
      try {
        const res = await fetchShots({
          title: game.title,
          limit: 8,
          size2x: true,
          minScore: 0.6,
          minScoreFallback: 0.45,
          includeVideo: false,
        } as any);
        if (!cancelled) {
          const urls = Array.isArray((res as any)?.urls) ? (res as any).urls : [];
          setIgdbUrls(urls);
        }
      } catch {
        if (!cancelled) setIgdbUrls([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [game?.title, fetchShots]);

  // FORM STATE
  const [title, setTitle] = useState("");
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [extraTrailerUrl, setExtraTrailerUrl] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [weeklyPrice, setWeeklyPrice] = useState<string>("");
  const [genres, setGenres] = useState<string>("");
  const [extraImagesText, setExtraImagesText] = useState("");

  useEffect(() => {
    if (!game) return;
    setTitle(game.title ?? "");
    setPlan((game as any).plan ?? "free");
    setDescription((game as any).description ?? "");
    setCoverUrl((game as any).cover_url ?? "");
    setTrailerUrl((game as any).trailer_url ?? "");
    setExtraTrailerUrl((game as any).extraTrailerUrl ?? "");
    setPurchasePrice(
      typeof (game as any).purchasePrice === "number" ? String((game as any).purchasePrice) : ""
    );
    setWeeklyPrice(
      typeof (game as any).weeklyPrice === "number" ? String((game as any).weeklyPrice) : ""
    );
    setGenres(((game as any).genres ?? []).join(", "));
    setExtraImagesText(((game as any).extraImages ?? []).join("\n"));
  }, [game]);

  // PREVIEW: 2 trailers si hay ambos
  const trailerEmbedPrimary = useMemo(
    () => toEmbed((game as any)?.trailer_url ?? null),
    [game?.trailer_url]
  );
  const trailerEmbedAlt = useMemo(
    () => toEmbed((game as any)?.extraTrailerUrl ?? null),
    [(game as any)?.extraTrailerUrl]
  );

  const extraImages = useMemo(() => {
    const raw = (game as any)?.extraImages as string[] | undefined;
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string" && s.trim()) : [];
  }, [(game as any)?.extraImages]);

  const media: MediaItem[] = useMemo(() => {
    const out: MediaItem[] = [];
    if (trailerEmbedPrimary) {
      out.push({ type: "video", src: trailerEmbedPrimary, thumb: (game as any)?.cover_url || undefined });
    }
    if (trailerEmbedAlt) {
      out.push({ type: "video", src: trailerEmbedAlt, thumb: (game as any)?.cover_url || undefined });
    }
    if (igdbUrls.length) {
      out.push(...igdbUrls.map<MediaItem>((u) => ({ type: "image", src: u })));
    }
    if (extraImages.length) {
      out.push(...extraImages.map<MediaItem>((u) => ({ type: "image", src: u })));
    }
    if (!out.length && (game as any)?.cover_url) {
      out.push({ type: "image", src: (game as any).cover_url });
    }
    return out;
  }, [trailerEmbedPrimary, trailerEmbedAlt, igdbUrls, extraImages, (game as any)?.cover_url]);

  // slideshow
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [isHoverMain, setIsHoverMain] = useState(false);
  const thumbsPerView = 4;

  useEffect(() => {
    if (selectedIndex >= media.length) setSelectedIndex(0);
  }, [media.length, selectedIndex]);

  useEffect(() => {
    if (!media.length || isHoverMain) return;
    const t = setInterval(() => setSelectedIndex((p) => (p + 1) % media.length), 4000);
    return () => clearInterval(t);
  }, [media.length, isHoverMain]);

  const prevThumbs = () => { if (thumbStart > 0) setThumbStart((p) => p - 1); };
  const nextThumbs = () => { if (thumbStart + thumbsPerView < media.length) setThumbStart((p) => p + 1); };

  const current = media[selectedIndex];

  // SAVE
  const updateGame = useMutation(api.mutations.admin.updateGame.updateGame as any);
  const [saving, setSaving] = useState(false);

  const toNumberOrUndefined = (s: string): number | undefined => {
    if (s.trim() === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const parseList = (text: string): string[] | undefined => {
    const clean = text.replace(/\r/g, "");
    const arr = clean
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : undefined;
  };

  const onSave = async () => {
    if (!game?._id) return;
    setSaving(true);
    try {
      const patch: any = {};

      // texto plano
      if (title !== game.title) patch.title = title;
      if (plan !== (game as any).plan) patch.plan = plan;
      if (description !== (game as any).description) {
        patch.description = description || null; // permitir limpiar si queda vacío
      }

      // urls clearables: si input vacío => null
      const origCover = (game as any).cover_url ?? "";
      const origTrailer = (game as any).trailer_url ?? "";
      const origTrailerExtra = (game as any).extraTrailerUrl ?? "";

      if (coverUrl !== origCover) {
        patch.cover_url = coverUrl.trim() === "" ? null : coverUrl.trim();
      }
      if (trailerUrl !== origTrailer) {
        patch.trailer_url = trailerUrl.trim() === "" ? null : trailerUrl.trim();
      }
      if (extraTrailerUrl !== origTrailerExtra) {
        patch.extraTrailerUrl = extraTrailerUrl.trim() === "" ? null : extraTrailerUrl.trim();
      }

      // precios: si vacío y antes había algo -> null
      const pp = toNumberOrUndefined(purchasePrice);
      const hadPP = typeof (game as any).purchasePrice === "number";
      if (typeof pp !== "undefined") patch.purchasePrice = pp;
      else if (!hadPP && purchasePrice.trim() !== "") {
        // si el valor es basura, ignoramos
      } else if (hadPP && purchasePrice.trim() === "") {
        patch.purchasePrice = null;
      }

      const wp = toNumberOrUndefined(weeklyPrice);
      const hadWP = typeof (game as any).weeklyPrice === "number";
      if (typeof wp !== "undefined") patch.weeklyPrice = wp;
      else if (!hadWP && weeklyPrice.trim() !== "") {
      } else if (hadWP && weeklyPrice.trim() === "") {
        patch.weeklyPrice = null;
      }

      // géneros
      const genresArr = parseList(genres);
      if (genresArr) patch.genres = genresArr;
      else if (Array.isArray((game as any).genres) && (game as any).genres!.length && genres.trim() === "") {
        patch.genres = []; // limpiar
      }

      // imágenes extra
      const extras = parseList(extraImagesText);
      if (typeof extras !== "undefined") {
        patch.extraImages = extras; // set
      } else {
        const hadExtras = Array.isArray((game as any).extraImages) && (game as any).extraImages.length > 0;
        if (hadExtras && extraImagesText.trim() === "") {
          patch.extraImages = []; // clear
        }
      }

      if (Object.keys(patch).length === 0) {
        toast({ title: "Sin cambios", description: "No hay nada que guardar." });
        setSaving(false);
        return;
      }

      await updateGame({ gameId: game._id as Id<"games">, patch } as any);

      toast({ title: "Guardado", description: "El juego se actualizó correctamente." });
      
      // Redirect to admin panel after successful save
      setTimeout(() => {
        router.push("/admin");
      }, 1000);
    } catch (e: any) {
      toast({
        title: "Error al guardar",
        description: e?.message || "No se pudo actualizar el juego.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = hasId && game === undefined;
  const notFound = hasId && game === null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button
                variant="outline"
                className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </Link>
            <h1 className="text-4xl font-bold text-orange-400">Editar juego</h1>
          </div>
          <Button
            onClick={onSave}
            disabled={saving || !game}
            className="bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold"
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        {isLoading && <div className="text-slate-300">Cargando…</div>}
        {notFound && <div className="text-slate-300">Juego no encontrado.</div>}

        {game && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Preview */}
            <div className="space-y-6">
              <div
                className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden"
                onMouseEnter={() => setIsHoverMain(true)}
                onMouseLeave={() => setIsHoverMain(false)}
              >
                {current?.type === "video" ? (
                  <iframe
                    src={current.src}
                    title={game.title}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <Image
                    src={current?.src || "/placeholder.svg"}
                    alt={game.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              <div className="bg-slate-800/70 border border-orange-400/20 rounded-lg px-4 py-3 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-orange-400">{game.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-400 text-slate-900 hover:bg-orange-500">
                    {(game as any).plan?.toUpperCase() || "FREE"}
                  </Badge>
                </div>
              </div>

              {/* thumbs */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={prevThumbs}
                    variant="outline"
                    size="icon"
                    disabled={thumbStart === 0}
                    className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex-1 grid grid-cols-4 gap-2">
                    {media
                      .slice(thumbStart, thumbStart + thumbsPerView)
                      .map((m, idx) => {
                        const i = thumbStart + idx;
                        const selected = i === selectedIndex;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedIndex(i)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                              selected ? "border-orange-400" : "border-slate-600"
                            }`}
                            title={m.type === "video" ? "Trailer" : `Screenshot ${i + 1}`}
                          >
                            {m.type === "video" ? (
                              <>
                                <Image
                                  src={m.thumb || (game as any).cover_url || "/placeholder.svg"}
                                  alt="Trailer"
                                  width={120}
                                  height={68}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 grid place-items-center">
                                  <div className="bg-white/90 text-slate-900 rounded-full p-1">
                                    <Play className="w-4 h-4" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Image
                                src={m.src}
                                alt={`${game.title} screenshot ${i + 1}`}
                                width={120}
                                height={68}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </button>
                        );
                      })}
                  </div>

                  <Button
                    onClick={nextThumbs}
                    variant="outline"
                    size="icon"
                    disabled={thumbStart + thumbsPerView >= media.length}
                    className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-orange-400 mb-4">Descripción</h3>
                <p className="text-slate-300 leading-relaxed">
                  {(game as any).description ?? "Sin descripción"}
                </p>
              </div>
            </div>

            {/* RIGHT: Form */}
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-lg border border-orange-400 p-6 space-y-4">
                <div>
                  <Label className="text-orange-400 mb-2 block">Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-orange-400 mb-2 block">Plan</Label>
                    <Select value={plan} onValueChange={(val: "free" | "premium") => setPlan(val)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-orange-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="free" className="text-orange-400">free</SelectItem>
                        <SelectItem value="premium" className="text-orange-400">premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-orange-400 mb-2 block">Géneros (coma o salto de línea)</Label>
                    <Input
                      value={genres}
                      onChange={(e) => setGenres(e.target.value)}
                      placeholder="Acción, Aventura"
                      className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-orange-400 mb-2 block">Precio compra</Label>
                    <Input
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="19.99"
                      className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-orange-400 mb-2 block">Precio alquiler (sem)</Label>
                    <Input
                      value={weeklyPrice}
                      onChange={(e) => setWeeklyPrice(e.target.value)}
                      placeholder="3.99"
                      className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-orange-400 mb-2 block">Cover URL</Label>
                  <Input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://…"
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-orange-400 mb-2 block">Trailer principal (YouTube/Vimeo)</Label>
                    <Input
                      value={trailerUrl}
                      onChange={(e) => setTrailerUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-orange-400 mb-2 block">Trailer extra (opcional)</Label>
                    <Input
                      value={extraTrailerUrl}
                      onChange={(e) => setExtraTrailerUrl(e.target.value)}
                      placeholder="https://youtu.be/…"
                      className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-orange-400 mb-2 block">Imágenes extra (1 por línea o separadas por coma)</Label>
                  <Textarea
                    value={extraImagesText}
                    onChange={(e) => setExtraImagesText(e.target.value)}
                    placeholder={"https://…/img1.jpg\nhttps://…/img2.jpg"}
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500 min-h-[120px]"
                  />
                </div>

                <div>
                  <Label className="text-orange-400 mb-2 block">Descripción</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500 min-h-[120px]"
                  />
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
                <p className="text-slate-400 text-sm">
                  La vista previa usa: <span className="text-orange-300">trailer principal y/o extra</span>,{" "}
                  <span className="text-orange-300">screenshots IGDB</span> y{" "}
                  <span className="text-orange-300">imágenes extra</span>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
