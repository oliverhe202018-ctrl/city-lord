'use server';

export interface TranscribeResult {
  success: boolean;
  text: string;
  error?: string;
}

export async function transcribeVoice(audioUrl: string): Promise<TranscribeResult> {
  try {
    if (!audioUrl) {
      return { success: false, text: '', error: '音频 URL 不能为空' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, text: '', error: '未配置 OpenAI API Key' };
    }

    // 下载音频文件
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return { success: false, text: '', error: '无法下载音频文件' };
    }

    const audioBlob = await audioResponse.blob();

    // 构建 FormData 用于 Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'zh');

    // 调用 OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      return {
        success: false,
        text: '',
        error: errorData?.error?.message || '转写服务调用失败',
      };
    }

    const result = await whisperResponse.json();

    return {
      success: true,
      text: result.text || '',
    };
  } catch (error) {
    console.error('[transcribeVoice] unexpected error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
