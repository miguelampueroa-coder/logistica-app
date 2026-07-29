// Audio transcription service.
// Interface-based design — swap provider by changing the implementation.
// MVP: returns a stub. Fase 2: integrate OpenAI Whisper / Deepgram / Google STT.

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
  rawTranscript?: string;
}

export interface AudioTranscriptionProvider {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>;
}

/**
 * Mock provider for development.
 * Simulates transcription by returning the audio as a placeholder.
 */
export class MockAudioTranscriptionProvider implements AudioTranscriptionProvider {
  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    console.log(`[AudioTranscription] Mock transcribe: ${audioBuffer.length} bytes, ${mimeType}`);
    return {
      text: '[Audio recibido — transcripción no disponible en modo desarrollo]',
      confidence: 0,
      language: 'es',
      durationMs: 0,
    };
  }
}

/**
 * OpenAI Whisper provider (for production).
 * Requires OPENAI_API_KEY environment variable.
 */
export class WhisperAudioTranscriptionProvider implements AudioTranscriptionProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const formData = new FormData();
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json() as {
      text: string;
      language: string;
      duration: number;
    };

    return {
      text: data.text,
      confidence: 0.85,
      language: data.language || 'es',
      durationMs: Math.round((data.duration || 0) * 1000),
      rawTranscript: data.text,
    };
  }
}

/**
 * Audio transcription service that delegates to a provider.
 */
export class AudioTranscriptionService {
  private provider: AudioTranscriptionProvider;

  constructor(provider?: AudioTranscriptionProvider) {
    this.provider = provider || new MockAudioTranscriptionProvider();
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    return this.provider.transcribe(audioBuffer, mimeType);
  }
}
