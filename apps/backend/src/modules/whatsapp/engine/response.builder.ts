import { DispatchOrderData } from '../types/index.js';
import { PriceBreakdown } from '../../../types/index.js';

export class ResponseBuilder {
  greeting(): string {
    return '¡Hola! Soy el asistente de Envíos. ¿Necesitas enviar algo? Puedo ayudarte a crear un despacho, cotizar o consultar el estado de un envío.';
  }

  returningCustomerGreeting(): string {
    return '¡Hola de nuevo! ¿Qué necesitas? Puedo crear un despacho, cotizar o consultar un envío.';
  }

  goodbye(): string {
    return '¡Hasta luego! Si necesitas algo más, escríbeme cuando quieras.';
  }

  help(): string {
    return 'Puedo ayudarte con:\n- Crear un despacho nuevo\n- Cotizar un envío\n- Consultar estado de un envío\n- Cancelar un despacho\n\nSolo escríbeme lo que necesitas.';
  }

  humanHandoff(): string {
    return 'Te estoy transfiriendo a un operador humano. En unos minutos te atenderá. Mientras tanto, tu conversación quedará registrada.';
  }

  askOrigin(): string {
    return '¿Desde dónde lo retiramos? Escribe la dirección o comparte tu ubicación.';
  }

  askDestination(): string {
    return '¿Dónde lo entregamos? Escribe la dirección de destino.';
  }

  askRecipient(): string {
    return '¿Quién recibe? Envíame nombre y teléfono, o comparte el contacto.';
  }

  askPackage(): string {
    return '¿Qué envías? Describe el paquete (tipo, peso aproximado, tamaño).';
  }

  ambiguousAddress(options: string[]): string {
    if (options.length === 0) return 'No encontré esa dirección. ¿Puedes ser más específico?';
    const lines = ['Encontré varias opciones:', ''];
    options.forEach((opt, i) => {
      lines.push(`${i + 1}. ${opt}`);
    });
    lines.push('', '¿Cuál es la correcta? Escribe el número.');
    return lines.join('\n');
  }

  confirmOriginAndAskDestination(origin: string): string {
    return `Retiro en: ${origin}\n\n¿Dónde lo entregamos?`;
  }

  confirmDestinationAndAskRecipient(destination: string): string {
    return `Entrega en: ${destination}\n\n¿Quién recibe? Envíame nombre y teléfono.`;
  }

  confirmRecipientAndAskPackage(name: string, phone: string): string {
    return `Recibe: ${name} (${phone})\n\n¿Qué envías? Describe el paquete.`;
  }

  orderSummary(draft: Partial<DispatchOrderData>, quote: PriceBreakdown): string {
    const lines = [
      '*Resumen del despacho:*',
      '',
      `Retiro: ${draft.originAddress || 'No definido'}`,
      `Entrega: ${draft.destAddress || 'No definido'}`,
      `Recibe: ${draft.destContactName || 'No definido'}${draft.destContactPhone ? ` (${draft.destContactPhone})` : ''}`,
      `Carga: ${draft.packageDescription || 'No definido'}`,
      draft.packageWeightKg ? `Peso: ${draft.packageWeightKg} kg` : '',
      draft.urgency ? 'Urgente' : '',
      '',
      `*Precio: $${quote.totalPrice.toLocaleString('es-CL')} CLP*`,
      `(Base: $${quote.basePrice} + Peso: $${quote.weightFee} + Volumen: $${quote.volumeFee}${quote.urgencyFee > 0 ? ` + Urgencia: $${quote.urgencyFee}` : ''})`,
      '',
      '¿Confirmas el despacho? Responde *si* o *no*.',
    ];
    return lines.filter(l => l !== '').join('\n');
  }

  confirmOrder(): string {
    return '¿Confirmas el despacho? Responde *si* para crear la orden o *no* para cancelar.';
  }

  orderCreated(orderId: string): string {
    const shortCode = orderId.substring(0, 8).toUpperCase();
    return `Tu despacho fue creado con el codigo *${shortCode}*.\n\nTe avisare cuando se asigne un conductor. Puedes consultar el estado escribiendo "donde esta mi envio"`;
  }

  orderError(error: string): string {
    return `No pude crear el despacho: ${error}\n\nPor favor intenta nuevamente o escribe "hablar con una persona" para atencion manual.`;
  }

  orderCancelled(): string {
    return 'Tu envio fue cancelado. Si necesitas algo mas, escríbeme.';
  }

  orderCancelledStart(): string {
    return 'Ok, cancelamos la cotizacion. Si necesitas algo mas, avísame.';
  }

  noActiveOrder(): string {
    return 'No tengo un envio activo asociado a tu numero. ¿Deseas crear uno nuevo?';
  }

  askWhatElse(): string {
    return '¿Necesitas algo mas? Puedo crear otro despacho, cotizar, o consultar un envio.';
  }

  fallback(): string {
    return 'No estoy seguro de entender. ¿Necesitas enviar algo, cotizar un envio, o consultar el estado? También puedes escribir "hablar con una persona" para atencion manual.';
  }

  trackingInfo(shipment: {
    status: string;
    origin_address?: string;
    dest_address?: string;
    total_price?: number;
    picked_up_at?: string;
    delivered_at?: string;
  }): string {
    const statusMap: Record<string, string> = {
      'pending': 'Pendiente - esperando conductor',
      'accepted': 'Conductor asignado - en preparacion',
      'in_transit': 'En camino',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado',
    };

    const statusText = statusMap[shipment.status] || shipment.status;

    const lines = [
      `*Estado del envio:* ${statusText}`,
      '',
      shipment.origin_address ? `Origen: ${shipment.origin_address}` : '',
      shipment.dest_address ? `Destino: ${shipment.dest_address}` : '',
      shipment.total_price ? `Precio: $${shipment.total_price.toLocaleString('es-CL')}` : '',
      shipment.delivered_at ? `Entregado: ${new Date(shipment.delivered_at).toLocaleString('es-CL')}` : '',
    ];

    return lines.filter(l => l !== '').join('\n');
  }
}
