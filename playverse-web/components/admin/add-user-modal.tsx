"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: {
    username: string;
    email: string;
    password: string;
    role: "free" | "premium" | "admin";
    // status NO se envía; es sólo visual en este modal
  }) => void;
}

export function AddUserModal({ isOpen, onClose, onSave }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "free" as "free" | "premium" | "admin", // valores reales del schema
    status: "Activo", // sólo visual
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }

    // Normalizamos el rol a valores válidos del schema, en minúsculas
    const normalizedRole: "free" | "premium" | "admin" =
      formData.role === "admin" || formData.role === "premium" || formData.role === "free"
        ? formData.role
        : "free";

    // Enviamos únicamente los campos del schema (status queda fuera)
    onSave({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      role: normalizedRole,
    });

    // Reset
    setFormData({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "free",
      status: "Activo",
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-orange-400 text-orange-400 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-orange-400 text-xl font-bold text-center">Añadir usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-orange-400 mb-2 block">Nombre de usuario</Label>
            <Input
              placeholder="Ingrese un nombre de usuario..."
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <Label className="text-orange-400 mb-2 block">Email</Label>
            <Input
              type="email"
              placeholder="Ingrese un email..."
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
              required
            />
          </div>

          {/* Passwords */}
          <div>
            <Label className="text-orange-400 mb-2 block">Contraseña</Label>
            <Input
              type="password"
              placeholder="********"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <Label className="text-orange-400 mb-2 block">Repetir contraseña</Label>
            <Input
              type="password"
              placeholder="********"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Rol: valores del schema en minúsculas */}
            <div>
              <Label className="text-orange-400 mb-2 block">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as "free" | "premium" | "admin" })
                }
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-orange-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="free" className="text-orange-400">free</SelectItem>
                  <SelectItem value="premium" className="text-orange-400">premium</SelectItem>
                  <SelectItem value="admin" className="text-orange-400">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado: visual (no se envía al backend) */}
            <div>
              <Label className="text-orange-400 mb-2 block">Estado (visual)</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-orange-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="Activo" className="text-orange-400">Activo</SelectItem>
                  <SelectItem value="Baneado" className="text-orange-400">Baneado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
