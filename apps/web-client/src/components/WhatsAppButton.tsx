'use client';

import { MessageCircle } from 'lucide-react';

interface WhatsAppButtonProps {
  message?: string;
  phone?: string;
  className?: string;
  variant?: 'floating' | 'inline' | 'hero';
}

export default function WhatsAppButton({
  message = 'Hola, quiero enviar un paquete por Enviazo',
  phone = '56912345678',
  className = '',
  variant = 'floating',
}: WhatsAppButtonProps) {
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  if (variant === 'hero') {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 bg-green-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-600 transition-colors ${className}`}
      >
        <MessageCircle className="h-5 w-5" />
        Enviar por WhatsApp
      </a>
    );
  }

  if (variant === 'inline') {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-600 transition-colors ${className}`}
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </a>
    );
  }

  // floating
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-6 right-6 bg-green-500 text-white rounded-full p-4 shadow-lg hover:bg-green-600 transition-all hover:scale-110 z-40 ${className}`}
      aria-label="Enviar por WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
