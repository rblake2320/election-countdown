// Cloudflare Turnstile verification middleware

export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  
  // If secret is not configured, skip verification (dev mode)
  if (!secret) {
    return true;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: ip,
        }),
      }
    );

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

// Check if Turnstile is configured
export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

// Express middleware wrapper - enforces Turnstile when configured
export function requireTurnstile(req: any, res: any, next: any) {
  const turnstileConfigured = isTurnstileConfigured();
  const token = req.body.turnstileToken;
  const ip = req.ip || req.connection?.remoteAddress;

  // If Turnstile is configured, require token
  if (turnstileConfigured && !token) {
    return res.status(400).json({ 
      message: 'Bot verification required' 
    });
  }

  // If not configured, skip verification
  if (!turnstileConfigured) {
    return next();
  }

  // Verify token
  verifyTurnstileToken(token, ip).then(valid => {
    if (!valid) {
      return res.status(403).json({ 
        message: 'Bot verification failed' 
      });
    }
    next();
  }).catch(error => {
    console.error('Turnstile middleware error:', error);
    res.status(500).json({ message: 'Verification error' });
  });
}
