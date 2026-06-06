/**
 * Email sending via Zoho ZeptoMail transactional email API.
 * Supports: register, login, reset password verification codes.
 * @see https://www.zoho.com/zeptomail/help/api/email-sending.html
 */

const ZEPTOMAIL_API_URL = 'https://api.zeptomail.com/v1.1/email/template';
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_API_KEY || '';

// From address — must be a verified sender domain in your ZeptoMail Agent
const FROM_ADDRESS = process.env.ZEPTOMAIL_FROM_ADDRESS || 'noreply@citytour.games';
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || '城市领主安全中心';

export type EmailType = 'register' | 'login' | 'reset';

interface SendResult {
  success: boolean;
  data?: any;
  error?: any;
}

// ─── Template Keys ────────────────────────────────────────────────────────────

const TEMPLATE_KEYS: Record<EmailType, string> = {
  reset: '2d6f.5219295b459e8d2e.k1.93c56220-189b-11f1-b6bb-525400d4bb1c.19cbe4c3142',
  register: '2d6f.5219295b459e8d2e.k1.8b4d1c01-189b-11f1-b6bb-525400d4bb1c.19cbe4bf9c0',
  login: '2d6f.5219295b459e8d2e.k1.7e02b461-189b-11f1-b6bb-525400d4bb1c.19cbe4ba2a1',
};

// ─── Send Function ────────────────────────────────────────────────────────────

export async function sendVerificationCode(
  to: string,
  code: string,
  type: EmailType = 'register'
): Promise<SendResult> {
  const templateKey = TEMPLATE_KEYS[type];

  try {
    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': ZEPTOMAIL_TOKEN,
      },
      body: JSON.stringify({
        template_key: templateKey,
        from: {
          address: FROM_ADDRESS,
          name: FROM_NAME,
        },
        to: [
          {
            email_address: {
              address: to,
              name: to.split('@')[0],
            },
          },
        ],
        merge_info: {
          OTP: code,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[ZeptoMail] API Error:', response.status, result);
      return {
        success: false,
        error: result?.message || result?.error || `HTTP ${response.status}`,
      };
    }

    console.log('[ZeptoMail] Template email sent successfully:', type, to);
    return { success: true, data: result };
  } catch (err: any) {
    console.error('[ZeptoMail] Exception:', err);
    return { success: false, error: err.message || err };
  }
}
