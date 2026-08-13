import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import WhatsAppButton from '@/components/WhatsAppButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Enviazo - Envía cualquier paquete por WhatsApp',
  description: 'Plataforma de envíos tipo Uber. Publica tu paquete y recíbelo rápido.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="bg-gray-50 border-t py-6">
              <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
                <p>© 2026 Enviazo. Todos los derechos reservados.</p>
              </div>
            </footer>
            <WhatsAppButton
              variant="floating"
              message="Hola Enviazo, quiero enviar un paquete. ¿Puedes ayudarme?"
              phone="56912345678"
            />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
