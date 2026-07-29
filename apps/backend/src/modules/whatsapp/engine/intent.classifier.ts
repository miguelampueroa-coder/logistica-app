import { IntentType, IntentResult, ConversationStep } from '../types/index.js';

interface IntentPattern {
  intent: IntentType;
  keywords: RegExp[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'create_order',
    keywords: [
      /(?:necesito|quiero|deseo|voy a|mando|envio|enviar|despachar|mandar)/i,
      /(?:envio|envío|despacho|paquete|caja|sobre|documentos?|cosa|pedido|bulto)/i,
      /(?:mandar|mandalo|enviar|despachar)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'quote_order',
    keywords: [
      /(?:cuánto|cuanto|cuánto cuesta|cuanto vale|precio|cotizar|cotización|presupuesto|tarifa)/i,
      /(?:costo|costará|costaria|valdrá|valdría)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'track_order',
    keywords: [
      /(?:dónde|donde está|dónde viene|dónde va|ubicación|ubicacion|seguimiento|tracking|status|estado)/i,
      /(?:cuánto falta|cuanto falta|ya llego|ya llegó|cuándo llega|cuando llega)/i,
      /(?:quién lo lleva|quien lo lleva|quién lo trae|quien lo trae)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'cancel_order',
    keywords: [
      /(?:cancelar|cancela|cancelalo|anular|anula|ya no quiero|mejor no|olvídalo|olvidalo)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'modify_order',
    keywords: [
      /(?:cambiar|modificar|actualizar|cambiame|modificame)/i,
      /(?:dirección|direccion|horario|destinatario|observación|reprogramar)/i,
    ],
    weight: 0.9,
  },
  {
    intent: 'repeat_order',
    keywords: [
      /(?:repetir|repetí|lo mismo|igual|otra vez|como siempre|donde siempre|misma cosa)/i,
      /(?:el de ayer|el último|el anterior)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'ask_help',
    keywords: [
      /(?:ayuda|help|no entiendo|qué puedes|que puedes|opciones|menú|menu)/i,
      /(?:cómo funciona|como funciona|qué hago|que hago)/i,
    ],
    weight: 0.8,
  },
  {
    intent: 'human_request',
    keywords: [
      /(?:humano|persona|operador|atención|atencion|hablar con|que hable|un agente)/i,
      /(?:soporte|ayuda humana)/i,
    ],
    weight: 1.0,
  },
  {
    intent: 'goodbye',
    keywords: [
      /(?:chao|adiós|adios|hasta luego|nos vemos|gracias|thank|bye)/i,
    ],
    weight: 0.6,
  },
];

export class IntentClassifier {
  /**
   * Classify intent with context awareness.
   * If we're in an active order flow, most messages are continuing the flow
   * unless they explicitly request something else.
   */
  classify(
    text: string,
    currentStep?: ConversationStep
  ): IntentResult {
    const normalizedText = text.trim().toLowerCase();

    if (!normalizedText) {
      return { intent: 'unknown', confidence: 0 };
    }

    // Score each intent
    const scores: Array<{ intent: IntentType; score: number }> = [];

    for (const pattern of INTENT_PATTERNS) {
      let matchCount = 0;
      for (const regex of pattern.keywords) {
        if (regex.test(normalizedText)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const score = (matchCount / pattern.keywords.length) * pattern.weight;
        scores.push({ intent: pattern.intent, score });
      }
    }

    if (scores.length === 0) {
      return { intent: 'unknown', confidence: 0.1 };
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    const confidence = Math.min(Math.max(best.score, 0), 1);

    return { intent: best.intent, confidence };
  }
}
