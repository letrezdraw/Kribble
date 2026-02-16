export declare const isPostgres: boolean;
export declare function initDatabase(): Promise<void>;
export declare function query(sql: string, params?: any[]): Promise<any>;
export declare function queryOne(sql: string, params?: any[]): Promise<any>;
export declare function run(sql: string, params?: any[]): Promise<{
    lastID?: number;
    changes?: number;
}>;
export declare const db: {
    prepare: (sql: string) => {
        get: (...params: any[]) => any;
        all: (...params: any[]) => any;
        run: (...params: any[]) => {
            lastInsertRowid: any;
            changes: number;
        } | {
            changes: number;
            lastInsertRowid?: undefined;
        };
    } | {
        get: (...params: any[]) => Promise<any>;
        all: (...params: any[]) => Promise<any[]>;
        run: (...params: any[]) => Promise<{
            lastID?: number;
            changes?: number;
        }>;
    };
    exec: (sql: string) => Promise<void>;
};
export declare function getPlayerStats(userId: string): Promise<any>;
export declare function updatePlayerStats(userId: string, updates: Partial<any>): Promise<void>;
export declare function incrementPlayerStat(userId: string, field: string, value?: number): Promise<void>;
export declare function addMatchHistory(userId: string, match: any): Promise<void>;
export declare function getMatchHistory(userId: string, limit?: number): Promise<any[]>;
export declare function getLeaderboard(limit?: number): Promise<any[]>;
export declare function getDailyChallenges(userId: string): Promise<any[]>;
export declare function updateChallengeProgress(userId: string, challengeId: string, progress: number): Promise<void>;
export declare function getWordsByCategory(categoryId?: string): Promise<string[]>;
export declare function getWordCategories(): Promise<{
    id: string;
    name: string;
}[]>;
