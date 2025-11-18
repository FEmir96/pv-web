"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: {
    username: string;
    email: string;
    password: string;
    role: "free" | "premium" | "admin";
    status: "Activo" | "Baneado";
  }) => void;
}

export function AddUserModal({ isOpen, onClose, onSave }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "free" as "free" | "premium" | "admin",
    status: "Activo" as "Activo" | "Baneado",
  });
  const { toast } = useToast();
  const passwordsMismatch =
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;
  const showFieldError = passwordsMismatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Las contrasenas no coinciden",
        description: "Revisa las contrasenas e intentalo de nuevo.",
        variant: "destructive",
        duration: 4000,
        "data-bar": "#ef4444",
      });
      return;
    }

    const normalizedRole: "free" | "premium" | "admin" =
      formData.role === "admin" || formData.role === "premium" || formData.role === "free"
        ? formData.role
        : "free";

    onSave({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      role: normalizedRole,
      status: formData.status,
    });

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
          <DialogTitle className="text-orange-400 text-xl font-bold text-center">Anadir usuario</DialogTitle>
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

          <div>
            <Label className="text-orange-400 mb-2 block">Contrasena</Label>
            <Input
              type="password"
              placeholder="********"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500 ${
                showFieldError ? "border-red-500 focus:border-red-500" : ""
              }`}
              required
            />
          </div>

          <div>
            <Label className="text-orange-400 mb-2 block">Repetir contrasena</Label>
            <Input
              type="password"
              placeholder="********"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={`bg-slate-900 border-slate-700 text-orange-400 placeholder:text-slate-500 ${
                showFieldError ? "border-red-500 focus:border-red-500" : ""
              }`}
              required
            />
            {showFieldError && (
              <p className="mt-1 text-sm text-red-400">
                Las contrasenas no coinciden.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  <SelectItem value="free" className="text-orange-400">
                    free
                  </SelectItem>
                  <SelectItem value="premium" className="text-orange-400">
                    premium
                  </SelectItem>
                  <SelectItem value="admin" className="text-orange-400">
                    admin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-orange-400 mb-2 block">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as "Activo" | "Baneado" })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-orange-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="Activo" className="text-orange-400">
                    Activo
                  </SelectItem>
                  <SelectItem value="Baneado" className="text-orange-400">
                    Baneado
                  </SelectItem>
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
