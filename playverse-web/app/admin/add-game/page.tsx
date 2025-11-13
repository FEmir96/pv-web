"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function AddGamePage() {
  const router = useRouter();
  const { toast } = useToast();
  const createGame = useMutation(api.mutations.admin.createGame.createGame as any);

  const [plan, setPlan] = useState<"free" | "premium">("free");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [trailer, setTrailer] = useState("");

  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [weeklyPrice, setWeeklyPrice] = useState<string>("");

  // NUEVO
  const [extraTrailerUrl, setExtraTrailerUrl] = useState<string>("");
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const addLanguage = () => {}; // (sin cambios, era decorativo en tu UI anterior)

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setExtraImages((prev) => [...prev, url]);
    setNewImageUrl("");
  };

  const removeImage = (idx: number) => {
    setExtraImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    try {
      if (!title.trim()) {
        toast({ title: "Falta título", variant: "destructive" });
        return;
      }
      const res = await createGame({
        title: title.trim(),
        plan,
        description: description.trim() || undefined,
        cover_url: cover.trim() || undefined,
        trailer_url: trailer.trim() || undefined,
        genres: category.trim() ? [category.trim()] : undefined,
        purchasePrice: purchasePrice.trim() || undefined,
        weeklyPrice: weeklyPrice.trim() || undefined,
        extraTrailerUrl: extraTrailerUrl.trim() || undefined,
        extraImages,
      });

      if (res?.ok) {
        toast({ title: "Juego creado", description: "Se añadió correctamente." });
        router.push("/admin");
      } else {
        throw new Error("Respuesta inválida");
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo crear el juego.", variant: "destructive" });
    }
  };

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
            <h1 className="text-4xl font-bold text-orange-400">Añadir juego</h1>
          </div>
          <Button onClick={handleCreate} className="bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold">
            Añadir
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Main Image (placeholder visual) */}
            <div>
              <Label className="text-orange-400 text-lg font-semibold mb-4 block">Imagen principal</Label>
              <div className="aspect-video bg-slate-700 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">Pegá el URL abajo (Cover URL)</p>
                </div>
              </div>
            </div>

            {/* Game Info */}
            <div className="bg-slate-900 rounded-lg border border-orange-400 p-6 space-y-4">
              <div>
                <Label className="text-orange-400 text-lg font-semibold mb-2 block">Título</Label>
                <Input
                  placeholder="Ingrese un título"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-orange-400 text-lg font-semibold mb-2 block">Plan</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={plan === "free" ? "default" : "outline"}
                    onClick={() => setPlan("free")}
                    className={plan === "free"
                      ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                      : "border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"}
                  >
                    Free
                  </Button>
                  <Button
                    type="button"
                    variant={plan === "premium" ? "default" : "outline"}
                    onClick={() => setPlan("premium")}
                    className={plan === "premium"
                      ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                      : "border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"}
                  >
                    Premium
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-orange-400 text-lg font-semibold mb-2 block">Categoría</Label>
                <Input
                  placeholder="Acción / RPG / ..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-orange-400 text-lg font-semibold mb-2 block">Precio de compra</Label>
                <Input
                  placeholder="19.99"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-orange-400 text-lg font-semibold mb-2 block">Precio de alquiler</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="3.99"
                    value={weeklyPrice}
                    onChange={(e) => setWeeklyPrice(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                  />
                  <span className="text-orange-400 italic">/sem</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-900 rounded-lg border border-orange-400 p-6 space-y-4">
              <Label className="text-orange-400 text-lg font-semibold block">Descripción</Label>
              <Textarea
                placeholder="Ingrese una descripción..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500 min-h-[100px]"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-lg border border-orange-400 p-6 space-y-4">
              <Label className="text-orange-400 text-lg font-semibold block">URLs</Label>

              <div>
                <Label className="text-slate-300 mb-1 block">Cover URL</Label>
                <Input
                  placeholder="https://..."
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-slate-300 mb-1 block">Trailer (principal)</Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={trailer}
                  onChange={(e) => setTrailer(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>

              {/* NUEVO */}
              <div>
                <Label className="text-slate-300 mb-1 block">Extra trailer (YouTube)</Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={extraTrailerUrl}
                  onChange={(e) => setExtraTrailerUrl(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">Si el principal está vacío, se usará este.</p>
              </div>

              <div>
                <Label className="text-slate-300 mb-2 block">Imágenes extra (URLs)</Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="https://..."
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-orange-400 placeholder:text-slate-500"
                  />
                  <Button onClick={addImage} className="bg-orange-400 hover:bg-orange-500 text-slate-900">
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                {extraImages.length === 0 ? (
                  <p className="text-slate-400 text-sm">No hay imágenes extra.</p>
                ) : (
                  <ul className="space-y-2">
                    {extraImages.map((url, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="flex-1 text-orange-300 truncate">{url}</span>
                        <Button
                          variant="ghost"
                          onClick={() => removeImage(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6v14m8-14v14M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/></svg>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg border border-slate-700 p-6">
              <p className="text-slate-400 text-sm">
                La página de juego combinará: 1 trailer (principal o extra), capturas IGDB y estas imágenes extra.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
