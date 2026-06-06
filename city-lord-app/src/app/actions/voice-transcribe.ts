import { rpcCall } from '@/api/client';

export const transcribeVoice = async (...args: any[]) => rpcCall('voice-transcribe', 'transcribeVoice', args);
