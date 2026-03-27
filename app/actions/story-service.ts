'use server';


interface RunStatsLite {
  distanceMeters: number;
  durationSeconds: number;
  hexesCaptured: number;
  steps: number;
  pace: string;
}

/**
 * generateRunStory: AI-powered storytelling for run summary
 * Uses Aliyun Qwen (OpenAI compatible) via standard fetch
 */
export async function generateRunStory(stats: RunStatsLite, faction: string) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = process.env.LLM_MODEL || 'qwen-plus';

  if (!apiKey) {
    console.warn('[StoryService] LLM_API_KEY is missing');
    return "由于通讯信号受到强烈干扰，战地记者未能传回完整战报。但整个城市都见证了您的英勇行动。";
  }

  const distanceKm = (stats.distanceMeters / 1000).toFixed(2);
  const timeStr = stats.durationSeconds > 60 
    ? `${Math.floor(stats.durationSeconds / 60)}分${stats.durationSeconds % 60}秒`
    : `${stats.durationSeconds}秒`;

  const prompt = `
你是一个极度热血且中二的赛博朋克风格战地记者。
玩家刚在现实城市中完成了一次紧张刺激的领地占领行动（占地跑）。
请根据以下战绩，写一段约 150 字的【史诗风格】战报。

战绩明细：
- 所属阵营：${faction}
- 奔袭距离：${distanceKm} 公里
- 作战用时：${timeStr}
- 占领领地：${stats.hexesCaptured} 块
- 奔走步数：${stats.steps} 步

要求：
1. 文风必须热血、硬核、带有赛博朋克或史诗奇幻色彩。
2. 强调“城市领主”的身份感，要把普通的跑步描写成一场改写城市版图的伟大战役。
3. 结尾要有一句适合发朋友圈的“逼格金句”。
4. 严禁废话，直接输出正文。
  `.trim();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一位擅长创作史诗战争纪录的文学大师，风格冷峻而热血。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('[StoryService] LLM API Error:', errData);
      throw new Error(`LLM_API_ERROR: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[StoryService] Failed to generate story:', err);
    return "数据核心正在解析本次战役的波谱... 虽然史诗战报生成失败，但你的每一声喘息都已刻进这座城市的基石。";
  }
}
