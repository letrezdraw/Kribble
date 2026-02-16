export declare class RateLimiter {
    private limits;
    private maxRequests;
    private windowMs;
    constructor(maxRequests: number, windowMs: number);
    canProceed(key: string): boolean;
    getRemainingTime(key: string): number;
    cleanup(): void;
}
export declare const guessRateLimiter: RateLimiter;
export declare const chatRateLimiter: RateLimiter;
export declare const drawRateLimiter: RateLimiter;
