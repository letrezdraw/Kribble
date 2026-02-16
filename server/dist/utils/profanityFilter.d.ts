export declare function containsProfanity(text: string): boolean;
export declare function censorProfanity(text: string): string;
export declare function validateUsername(username: string): {
    valid: boolean;
    error?: string;
};
export declare function validateMessage(message: string): {
    valid: boolean;
    censored?: string;
    error?: string;
};
