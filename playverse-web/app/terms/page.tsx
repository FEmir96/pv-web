export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-orange-400 mb-8">Términos y Condiciones</h1>

          <div className="prose prose-invert max-w-none">
            <div className="bg-slate-900/50 border border-orange-400/30 rounded-lg p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">1. Aceptación de los Términos</h2>
                <p className="text-slate-300 leading-relaxed">
                  Al acceder y utilizar PlayVerse, aceptas estar sujeto a estos términos y condiciones de uso. Si no
                  estás de acuerdo con alguna parte de estos términos, no debes usar nuestro servicio.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">2. Descripción del Servicio</h2>
                <p className="text-slate-300 leading-relaxed">
                  PlayVerse es una plataforma digital que permite a los usuarios comprar, alquilar y acceder a
                  videojuegos. Ofrecemos tanto opciones gratuitas como premium para mejorar la experiencia del usuario.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">3. Cuentas de Usuario</h2>
                <p className="text-slate-300 leading-relaxed">
                  Para utilizar ciertas funciones de PlayVerse, debes crear una cuenta. Eres responsable de mantener la
                  confidencialidad de tu cuenta y contraseña, y de todas las actividades que ocurran bajo tu cuenta.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">4. Compras y Pagos</h2>
                <p className="text-slate-300 leading-relaxed">
                  Todos los precios están sujetos a cambios sin previo aviso. Los pagos se procesan de forma segura a
                  través de nuestros proveedores de pago certificados. Las compras son finales, sujeto a nuestras
                  políticas de reembolso.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">5. Suscripción Premium</h2>
                <p className="text-slate-300 leading-relaxed">
                  Las suscripciones Premium se renuevan automáticamente. Puedes cancelar tu suscripción en cualquier
                  momento desde tu perfil. La cancelación será efectiva al final del período de facturación actual.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">6. Propiedad Intelectual</h2>
                <p className="text-slate-300 leading-relaxed">
                  Todo el contenido de PlayVerse, incluyendo textos, gráficos, logos, y software, está protegido por
                  derechos de autor y otras leyes de propiedad intelectual.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">7. Limitación de Responsabilidad</h2>
                <p className="text-slate-300 leading-relaxed">
                  PlayVerse no será responsable por daños indirectos, incidentales, especiales o consecuentes que
                  resulten del uso o la imposibilidad de usar nuestro servicio.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">8. Modificaciones</h2>
                <p className="text-slate-300 leading-relaxed">
                  Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán
                  efectivos inmediatamente después de su publicación en el sitio web.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-teal-400 mb-4">9. Contacto</h2>
                <p className="text-slate-300 leading-relaxed">
                  Si tienes preguntas sobre estos términos y condiciones, puedes contactarnos a través de nuestra página
                  de contacto o enviando un email a legal@playverse.com.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
