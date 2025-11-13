// playverse-web/app/catalogo/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import GameCard from "@/components/game-card";

const genres = ["Todos", "Acción", "RPG", "Carreras", "Shooter", "Sandbox", "Estrategia", "Deportes"];

export default function CatalogoPage() {
  const [selectedGenre, setSelectedGenre] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "premium">("all");
  const [sortType, setSortType] = useState<"recent" | "oldest">("recent");
  const pageSize = 12;

  const args = useMemo(
    () => ({
      q: searchQuery || undefined,
      genre: selectedGenre === "Todos" ? undefined : selectedGenre,
      plan: planFilter === "all" ? undefined : planFilter,
      page: currentPage,
      pageSize,
    }),
    [searchQuery, selectedGenre, planFilter, currentPage]
  );

  const result = useQuery(api.queries.searchGames.searchGames, args) as
    | { items: Doc<"games">[]; total: number; page: number; pageSize: number }
    | undefined;

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Client-side sort fallback: server may not accept `sort` yet, so sort locally
  const itemsSorted = useMemo(() => {
    if (!items || !items.length) return items;
    const out = items.slice();
    if (sortType === "oldest") {
      out.sort((a, b) => (Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0)));
    } else {
      out.sort((a, b) => (Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0)));
    }
    return out;
  }, [items, sortType]);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header Section */}
      <section className="bg-gradient-to-b from-slate-800 to-slate-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-orange-400 mb-4 tracking-wide">CATÁLOGO DE JUEGOS</h1>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed">
            ¡Sumérgete en el PlayVerse! Encuentra tu próxima obsesión entre nuestra vasta colección de títulos.
          </p>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="py-8 bg-slate-900 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-6">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3 items-center">
              {/* Plan filter buttons */}
              <div>
                <label className="sr-only">Filtrar por plan</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div>
                      <Button className="flex items-center gap-2 bg-slate-900 border border-amber-400 text-amber-400 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-800/95">
                        {planFilter === "all" ? "Todos" : planFilter === "free" ? "Free" : "Premium"}
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                      </Button>
                    </div>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" sideOffset={8} className="z-50 bg-slate-900 border border-amber-400 rounded-md p-1 shadow-md text-amber-400">
                    <DropdownMenuRadioGroup value={planFilter} onValueChange={(v) => { setPlanFilter(v as any); setCurrentPage(1); }}>
                      <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="free">Free</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="premium">Premium</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Genre filters */}
          <div className="flex flex-wrap gap-2 justify-center items-center">
            {genres.map((genre) => (
              <Button
                key={genre}
                variant={selectedGenre === genre ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedGenre(genre);
                  setCurrentPage(1);
                }}
                className={
                  selectedGenre === genre
                    ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                }
              >
                {genre}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {result ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {itemsSorted.map((g) => (
                  <GameCard key={g._id} game={g} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  const isCurrent = page === currentPage;
                  return (
                    <Button
                      key={page}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={
                        isCurrent
                          ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                          : "border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                      }
                    >
                      {page}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-center mt-4">
                <p className="text-slate-400 text-sm">
                  Página {currentPage} de {totalPages} • Mostrando {itemsSorted.length} de {total} resultados
                </p>
              </div>
            </>
          ) : (
            // Skeleton
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
