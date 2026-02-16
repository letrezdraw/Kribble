// Rate limiter utility for socket events
export class RateLimiter {
    limits = new Map();
    maxRequests;
    windowMs;
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }
    canProceed(key) {
        const now = Date.now();
        const entry = this.limits.get(key);
        if (!entry || now > entry.resetTime) {
            // New window
            this.limits.set(key, {
                count: 1,
                resetTime: now + this.windowMs,
            });
            return true;
        }
        if (entry.count >= this.maxRequests) {
            return false;
        }
        entry.count++;
        return true;
    }
    getRemainingTime(key) {
        const entry = this.limits.get(key);
        if (!entry)
            return 0;
        return Math.max(0, entry.resetTime - Date.now());
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now > entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }
}
// Pre-configured rate limiters
export const guessRateLimiter = new RateLimiter(5, 1000); // 5 guesses per second
export const chatRateLimiter = new RateLimiter(3, 1000); // 3 messages per second
export const drawRateLimiter = new RateLimiter(60, 1000); // 60 strokes per second
// Cleanup interval
setInterval(() => {
    guessRateLimiter.cleanup();
    chatRateLimiter.cleanup();
    drawRateLimiter.cleanup();
}, 60000); // Cleanup every minute
