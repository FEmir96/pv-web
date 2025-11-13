"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userData: any) => void
  user: any
}

export function EditUserModal({ isOpen, onClose, onSave, user }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "free",     // <- default válido según schema
    status: "Activo", // <- sólo visual; no se guarda en Convex
  })

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.name || "",
        email: user.email || "",
        // normalizamos a minúsculas válidas del schema
        role: (user.role === "admin" || user.role === "premium" || user.role === "free") ? user.role : "free",
        status: user.status || "Activo",
      })
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...user, ...formData })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-orange-400 text-orange-400 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-orange-400 text-xl font-bold text-center">Editar usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-orange-400 mb-2 block">Nombre de usuario</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400"
              required
            />
          </div>

          <div>
            <Label className="text-orange-400 mb-2 block">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-900 border-slate-700 text-orange-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-orange-400 mb-2 block">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
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
  )
}
