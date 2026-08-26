import { ExtractedEntities, AddressEntity, RecipientEntity, PackageEntity, ConversationStep } from '../types/index.js';

const PHONE_REGEX = /(?:\+?56)?\s*(?:9\s*)?\d{4}[\s.-]?\d{4}/;
const PHONE_CLEAN_REGEX = /[\s.\-+]/g;

const WEIGHT_REGEX = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?)/i;
const DIMENSIONS_REGEX = /(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?/i;
const SIZE_KEYWORDS: Record<string, { l: number; w: number; h: number }> = {
  'sobre': { l: 30, w: 20, h: 2 },
  'sobres': { l: 30, w: 20, h: 2 },
  'caja pequeña': { l: 20, w: 20, h: 20 },
  'caja chica': { l: 20, w: 20, h: 20 },
  'caja mediana': { l: 40, w: 30, h: 30 },
  'caja': { l: 40, w: 30, h: 30 },
  'cajas': { l: 40, w: 30, h: 30 },
  'paquete': { l: 40, w: 30, h: 30 },
  'paquetes': { l: 40, w: 30, h: 30 },
  'bulto': { l: 50, w: 40, h: 40 },
  'bultos': { l: 50, w: 40, h: 40 },
  'documento': { l: 35, w: 25, h: 1 },
  'documentos': { l: 35, w: 25, h: 1 },
  'factura': { l: 35, w: 25, h: 1 },
  'libro': { l: 30, w: 20, h: 5 },
  'libros': { l: 30, w: 20, h: 5 },
  'ropa': { l: 40, w: 30, h: 10 },
  'electrodoméstico': { l: 60, w: 50, h: 50 },
  'electrodomesticos': { l: 60, w: 50, h: 50 },
};

const URGENCY_KEYWORDS = /(?:urgente|rápido|rapido|ya|ahora|enseguida|lo antes posible|express|ipsum)/i;

export class EntityExtractor {
  extract(text: string, currentStep?: ConversationStep): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract recipient (name + phone)
    const recipient = this.extractRecipient(text);
    if (recipient.name || recipient.phone) {
      entities.recipient = recipient;
    }

    // Extract package info
    const pkg = this.extractPackage(text);
    if (pkg.description || pkg.weightKg) {
      entities.package = pkg;
    }

    // Extract urgency
    entities.urgency = URGENCY_KEYWORDS.test(text);

    // In an active order flow, the direct answer to "origen/destino" is an address
    const address = this.extractAddressInFlow(text, currentStep);
    if (address) {
      if (currentStep === 'collecting_destination') {
        entities.destination = address;
      } else if (currentStep === 'collecting_origin') {
        entities.origin = address;
      }
    }

    return entities;
  }

  extractAddress(text: string): AddressEntity | undefined {
    const cleaned = text.trim();
    if (cleaned.length < 5) return undefined;

    // Basic heuristic: address contains numbers and letters
    const hasNumber = /\d/.test(cleaned);
    const hasLetters = /[a-zA-Záéíóúñ]/.test(cleaned);
    const looksLikeAddress = hasNumber && hasLetters && cleaned.length >= 5;

    if (!looksLikeAddress) return undefined;

    return { address: cleaned };
  }

  private extractAddressInFlow(
    text: string,
    currentStep?: ConversationStep
  ): AddressEntity | undefined {
    if (currentStep !== 'collecting_origin' && currentStep !== 'collecting_destination') {
      return undefined;
    }

    const cleaned = text.trim();
    if (cleaned.length < 5) return undefined;

    const looksLikeRejection = /^(?:no\b|no se\b|no sé\b|nada\b|ns\b|cancelar\b)/i.test(cleaned);
    if (looksLikeRejection) return undefined;

    return this.extractAddress(cleaned) ?? { address: cleaned };
  }

  extractLocationFromShared(
    location: { lat: number; lng: number; address?: string }
  ): AddressEntity {
    return {
      address: location.address || `${location.lat}, ${location.lng}`,
      lat: location.lat,
      lng: location.lng,
    };
  }

  extractContactFromShared(
    contact: { name: string; phone: string }
  ): RecipientEntity {
    return {
      name: contact.name,
      phone: this.cleanPhone(contact.phone),
    };
  }

  private extractRecipient(text: string): RecipientEntity {
    const result: RecipientEntity = {};

    // Try to find phone
    const phoneMatch = text.match(PHONE_REGEX);
    if (phoneMatch) {
      result.phone = this.cleanPhone(phoneMatch[0]);
    }

    // Try to find name near "para", "recibe", "destinatario"
    const namePatterns = [
      /(?:para|recibe|a nombre de|nombre[:\s]+|destinatario[:\s]+)\s*(.+)/i,
      /(?:enviale a|mandale a|enviar a|llevar a)\s*(.+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        // Remove phone number from name if present
        const phoneInName = name.match(PHONE_REGEX);
        if (phoneInName) {
          name = name.replace(PHONE_REGEX, '').trim();
        }
        // Remove trailing punctuation
        name = name.replace(/[,;.\s]+$/, '').trim();
        if (name.length >= 2 && name.length <= 60) {
          result.name = name;
          break;
        }
      }
    }

    return result;
  }

  private extractPackage(text: string): PackageEntity {
    const pkg: PackageEntity = {};
    const lowerText = text.toLowerCase();

    // Extract weight
    const weightMatch = text.match(WEIGHT_REGEX);
    if (weightMatch) {
      pkg.weightKg = parseFloat(weightMatch[1].replace(',', '.'));
    }

    // Extract explicit dimensions
    const dimMatch = text.match(DIMENSIONS_REGEX);
    if (dimMatch) {
      pkg.lengthCm = parseFloat(dimMatch[1].replace(',', '.'));
      pkg.widthCm = parseFloat(dimMatch[2].replace(',', '.'));
      pkg.heightCm = parseFloat(dimMatch[3].replace(',', '.'));
    } else {
      // Try to match size keywords
      for (const [keyword, dims] of Object.entries(SIZE_KEYWORDS)) {
        if (lowerText.includes(keyword)) {
          pkg.lengthCm = dims.l;
          pkg.widthCm = dims.w;
          pkg.heightCm = dims.h;
          pkg.description = keyword;
          break;
        }
      }
    }

    // Extract description if not already set from size keywords
    if (!pkg.description) {
      const descPatterns = [
        /(?:envio|envío|enviar|mándar|mandar|despachar)\s+(.+)/i,
        /(?:un|una|unos|unas)\s+(.+)/i,
      ];
      for (const pattern of descPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let desc = match[1].trim();
          // Trim at first comma or period
          const stopIdx = desc.search(/[,;.]/);
          if (stopIdx > 0) desc = desc.substring(0, stopIdx);
          // Remove weight/dimensions mentions
          desc = desc.replace(WEIGHT_REGEX, '').replace(DIMENSIONS_REGEX, '').trim();
          if (desc.length >= 2 && desc.length <= 100) {
            pkg.description = desc;
            break;
          }
        }
      }
    }

    return pkg;
  }

  private cleanPhone(phone: string): string {
    return phone.replace(PHONE_CLEAN_REGEX, '').trim();
  }
}
