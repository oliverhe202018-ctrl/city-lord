import { cookies } from 'next/headers'

// In a real production app, this should be a strong 256-bit secret.
// Ensure this environment variable is set in your deployment.
const SECRET_KEY = process.env.ADMIN_SESSION_SECRET || 'fallback-secret-for-development-only'

/**
 * Helper to encode the secret into a CryptoKey for HMAC
 */
async function getCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const secretBuffer = encoder.encode(SECRET_KEY)
    return await crypto.subtle.importKey(
        'raw',
        secretBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    )
}

/**
 * Creates a signed token combining a payload and its HMAC signature.
 * Format: base64url(payload).base64url(signature)
 */
export async function signAdminToken(payload: string): Promise<string> {
    const encoder = new TextEncoder()
    const payloadBuffer = encoder.encode(payload)

    // Base64url encode the payload
    const payloadB64 = Buffer.from(payloadBuffer).toString('base64url')

    const key = await getCryptoKey()
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBuffer)

    // Base64url encode the signature
    const signatureB64 = Buffer.from(signatureBuffer).toString('base64url')

    return `${payloadB64}.${signatureB64}`
}

/**
 * Verifies the token and string-matches the signature.
 * Returns true if valid, false if not.
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
    try {
        if (!token || !token.includes('.')) return false

        const [payloadB64, signatureB64] = token.split('.')
        if (!payloadB64 || !signatureB64) return false

        const payloadBuffer = Buffer.from(payloadB64, 'base64url')
        const signatureBuffer = Buffer.from(signatureB64, 'base64url')

        const key = await getCryptoKey()

        // Verify the signature
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBuffer,
            payloadBuffer
        )

        return isValid
    } catch (e) {
        console.error('[verifyAdminToken] Error verifying token:', e)
        return false
    }
}

/**
 * Helper to be used in Server Actions to assert admin privileges.
 * Throws an error if the session is invalid.
 */
export async function requireAdminSession() {
    const cookieStore = await cookies()
    const token = cookieStore.get('citylord_admin_session')?.value

    if (!token) {
        throw new Error('Unauthorized: Admin access required')
    }

    const isValid = await verifyAdminToken(token)
    if (!isValid) {
        throw new Error('Unauthorized: Invalid admin session')
    }

    return true
}
