declare const router: import("express-serve-static-core").Router;
declare function cleanupExpiredGuests(): Promise<void>;
export { router as authRoutes, cleanupExpiredGuests };
