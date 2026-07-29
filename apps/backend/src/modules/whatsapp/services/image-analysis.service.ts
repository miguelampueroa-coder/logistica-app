// Image processing service for WhatsApp Logistics AI.
// Identifies package type, estimates dimensions, extracts text via OCR.
// Interface-based — swap provider by changing the implementation.

export interface ImageAnalysisResult {
  type: 'package' | 'document' | 'receipt' | 'label' | 'unknown';
  description: string;
  estimatedWeight?: number;
  estimatedDimensions?: { l: number; w: number; h: number };
  ocrText?: string;
  confidence: number;
}

export interface ImageAnalysisProvider {
  analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult>;
}

/**
 * Mock provider for development.
 * Returns a placeholder analysis.
 */
export class MockImageAnalysisProvider implements ImageAnalysisProvider {
  async analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult> {
    console.log(`[ImageAnalysis] Mock analyze: ${imageBuffer.length} bytes, ${mimeType}`);
    return {
      type: 'unknown',
      description: '[Imagen recibida — análisis no disponible en modo desarrollo]',
      confidence: 0,
    };
  }
}

/**
 * OpenAI Vision provider (for production).
 * Uses GPT-4 Vision to analyze images.
 * Requires OPENAI_API_KEY environment variable.
 */
export class OpenAIImageAnalysisProvider implements ImageAnalysisProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult> {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analiza esta imagen y extrae información logística. Responde en JSON:
{
  "type": "package|document|receipt|label|unknown",
  "description": "descripción breve del contenido",
  "estimatedWeight": number en kg o null,
  "estimatedDimensions": {"l": cm, "w": cm, "h": cm} o null,
  "ocrText": "texto visible en la imagen" o null,
  "confidence": 0-1
}
Si es un paquete, estima dimensiones y peso de forma orientativa.
Si es un documento, extrae el texto visible.
Si es una etiqueta de envío, extrae destinatario y dirección.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analiza esta imagen para logística de envíos.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Vision API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(content);
      return {
        type: parsed.type || 'unknown',
        description: parsed.description || 'Sin descripción',
        estimatedWeight: parsed.estimatedWeight || undefined,
        estimatedDimensions: parsed.estimatedDimensions || undefined,
        ocrText: parsed.ocrText || undefined,
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      return {
        type: 'unknown',
        description: content,
        confidence: 0.3,
      };
    }
  }
}

/**
 * Image analysis service that delegates to a provider.
 */
export class ImageAnalysisService {
  private provider: ImageAnalysisProvider;

  constructor(provider?: ImageAnalysisProvider) {
    this.provider = provider || new MockImageAnalysisProvider();
  }

  async analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult> {
    return this.provider.analyze(imageBuffer, mimeType);
  }
}
