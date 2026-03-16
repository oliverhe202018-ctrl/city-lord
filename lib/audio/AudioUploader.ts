import { createClient } from '@/lib/supabase/client';

export interface UploadAudioOptions {
  senderId: string;
  receiverId: string;
  audioBlob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface UploadAudioResult {
  path: string;
  sizeBytes: number;
}

function mimeTypeToExt(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export async function uploadAudio(options: UploadAudioOptions): Promise<UploadAudioResult> {
  const { senderId, receiverId, audioBlob, mimeType } = options;
  const supabase = createClient();

  const ext = mimeTypeToExt(mimeType);
  const fileName = `private/${senderId}/${receiverId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { data, error } = await supabase.storage
    .from('voice-messages')
    .upload(fileName, audioBlob, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  return {
    path: data.path,
    sizeBytes: audioBlob.size,
  };
}
