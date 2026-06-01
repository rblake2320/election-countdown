import rateLimit from 'express-rate-limit';

// Rate limit for vote intent submissions (max 5 per hour per IP)
export const voteIntentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many submissions. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for donation creation (max 10 per hour per IP)
export const donationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many donation attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
