"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Users, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { EditUserModal } from "@/components/admin/edit-user-modal";

type AdminGame = {
  _id: Id<"games">;
  title: string;
  plan: "free" | "premium";
  description?: string;
  cover_url?: string;
  trailer_url?: string;
  genres?: string[];
  purchasePrice?: number;
  weeklyPrice?: number;
};

type AdminProfile = {
  _id: Id<"profiles">;
  name: string;
  email: string;
  role: "free" | "premium" | "admin";
  status?: string;
};

export default function AdminPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"games" | "users">("games");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);

  const games = useQuery(api.queries.admin.listGames.listGames) as
    | AdminGame[]
    | undefined;
  const profiles = useQuery(api.queries.admin.listProfiles.listProfiles) as
    | AdminProfile[]
    | undefined;

  const deleteGame = useMutation(api.mutations.admin.deleteGame.deleteGame);
  const updateProfile = useMutation(
    api.mutations.admin.updateProfile.updateProfile
  );

  const filteredGames: AdminGame[] = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    return (games ?? []).filter((g: AdminGame) =>
      g.title.toLowerCase().includes(t)
    );
  }, [games, searchTerm]);

  const filteredUsers: AdminProfile[] = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    return (profiles ?? []).filter(
      (u: AdminProfile) =>
        u.name.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t)
    );
  }, [profiles, searchTerm]);

  const handleDeleteGame = async (gameId: string) => {
    try {
      await deleteGame({ id: gameId as Id<"games"> } as any);
      toast({
        title: "Juego eliminado",
        description: "Se eliminó correctamente.",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar.",
        variant: "destructive",
      });
    }
  };

  const openEditUserModal = (user: AdminProfile) => {
    setSelectedUser(user);
    setShowEditUserModal(true);
  };

  const handleAddUser = async () => {
    toast({
      title: "Alta de usuario",
      description:
        "Los usuarios se crean al iniciar sesión. Edita rol/estado desde esta vista.",
    });
  };

  const handleEditUser = async (data: any) => {
    // normalizamos rol a minúsculas válidas del schema
    const role: "free" | "premium" | "admin" =
      data.role === "admin" || data.role === "premium" || data.role === "free"
        ? data.role
        : "free";

    try {
      await updateProfile({
        id: data._id as Id<"profiles">,
        name: data.username,
        email: data.email,
        role,              // ✅ sólo campos del schema
        // status: no se envía porque no existe en el schema
      } as any);
      toast({ title: "Usuario actualizado", description: "Cambios guardados." });
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    toast({
      title: "Eliminar usuario",
      description:
        "Borrado no implementado por seguridad. Si lo necesitas, agregamos una mutación.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-orange-400 text-center">
                Panel de Administración
              </h1>
              <p className="text-slate-400 mt-1 text-center">
                Gestiona los usuarios y el catálogo de juegos de PlayVerse
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          <Button
            variant={activeTab === "games" ? "default" : "outline"}
            onClick={() => setActiveTab("games")}
            className={`flex items-center gap-2 ${
              activeTab === "games"
                ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                : "border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Gestionar juegos
          </Button>
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 ${
              activeTab === "users"
                ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
                : "border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
            }`}
          >
            <Users className="w-4 h-4" />
            Gestionar usuarios
          </Button>
        </div>

        {/* Games */}
        {activeTab === "games" && (
          <div className="space-y-6">
            {/* Search and Add */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>
              <Link href="/admin/add-game">
                <Button className="bg-orange-400 hover:bg-orange-500 text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Añadir juego
                </Button>
              </Link>
            </div>

            {/* Games Table */}
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Título
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Categoría
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Precio compra
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Precio alquiler
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGames.map((game: AdminGame) => (
                      <tr
                        key={String(game._id)}
                        className="border-b border-slate-700 hover:bg-slate-800/50"
                      >
                        <td className="p-4 text-orange-400 font-medium">
                          {game.title}
                        </td>
                        <td className="p-4 text-slate-300">
                          {game.plan === "premium" ? "Premium" : "Free"}
                        </td>
                        <td className="p-4 text-slate-300">
                          {game.purchasePrice != null
                            ? `$${game.purchasePrice}`
                            : "—"}
                        </td>
                        <td className="p-4 text-slate-300">
                          {game.weeklyPrice != null
                            ? `$${game.weeklyPrice}`
                            : "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/edit-game/${String(game._id)}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={() =>
                                handleDeleteGame(String(game._id))
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredGames.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-slate-400"
                        >
                          {games ? "Sin resultados" : "Cargando…"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Search and Add */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
                />
              </div>
              <Button
                className="bg-orange-400 hover:bg-orange-500 text-slate-900 flex items-center gap-2"
                onClick={() => setShowAddUserModal(true)}
              >
                <Plus className="w-4 h-4" />
                Añadir usuario
              </Button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Nombre de usuario
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Email
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Rol
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Estado
                      </th>
                      <th className="text-left p-4 text-slate-300 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredUsers ?? []).map((u: AdminProfile) => (
                      <tr
                        key={String(u._id)}
                        className="border-b border-slate-700 hover:bg-slate-800/50"
                      >
                        <td className="p-4 text-orange-400 font-medium">
                          {u.name}
                        </td>
                        <td className="p-4 text-slate-300">{u.email}</td>
                        <td className="p-4">
                          <Badge
                            variant={
                              u.role === "admin" ? "default" : "secondary"
                            }
                            className={
                              u.role === "admin"
                                ? "bg-orange-400 text-slate-900"
                                : "bg-slate-700 text-slate-300"
                            }
                          >
                            {u.role === "admin"
                              ? "Admin"
                              : u.role === "premium"
                              ? "Premium"
                              : "Usuario"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              u.status === "Baneado"
                                ? "destructive"
                                : "default"
                            }
                            className={
                              u.status === "Baneado"
                                ? "bg-red-600 text-white"
                                : "bg-green-600 text-white"
                            }
                          >
                            {u.status ?? "Activo"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-400 hover:text-orange-300"
                              onClick={() => openEditUserModal(u)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={handleDeleteUser}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(filteredUsers ?? []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-slate-400"
                        >
                          {profiles ? "Sin resultados" : "Cargando…"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSave={handleAddUser}
      />

      <EditUserModal
        isOpen={showEditUserModal}
        onClose={() => setShowEditUserModal(false)}
        onSave={handleEditUser}
        user={selectedUser}
      />
    </div>
  );
}
