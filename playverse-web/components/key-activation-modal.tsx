"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface KeyActivationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyActivationModal({ isOpen, onClose }: KeyActivationModalProps) {
  const [activationKey, setActivationKey] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle key activation logic here
    console.log("Activating key:", activationKey)
    // Close modal after activation
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        {/* Modal */}
        <div
          className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingresa tu clave</h2>
            <p className="text-slate-800">Añade un nuevo juego a tu PlayVerse y disfrútalo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="XXXX - XXXX - XXXX"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-center text-lg font-mono tracking-wider"
                maxLength={14}
                required
              />
            </div>

            <div className="text-center text-sm text-slate-800 mb-4">
              <p>Ingresa tu clave de activación temporal o perpetua de 12 caracteres</p>
              <p>alfanuméricos que recibiste en tu mail luego de una compra o alquiler.</p>
            </div>

            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3">
              Activar
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}
