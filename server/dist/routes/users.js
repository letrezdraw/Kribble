import { Router } from 'express';
import { db, getPlayerStats, getMatchHistory, getLeaderboard, getDailyChallenges, updateChallengeProgress } from '../db/index.js';
const router = Router();
// IMPORTANT: Mount specific routes BEFORE parameterized routes
// /leaderboard must come before /:id
// Get online players count - uses real socket connections from app.locals
router.get('/online/count', (req, res) => {
    try {
        // Get the connected sockets set from the main server
        const io = req.app.get('io');
        let count = 0;
        if (io) {
            // Get actual socket count
            count = io.engine.clientsCount || 0;
        }
        res.json({
            count,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Users] Error getting online count:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get leaderboard - MUST be before /:id
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const leaderboard = await getLeaderboard(limit);
        res.json({ leaderboard });
    }
    catch (error) {
        console.error('[Users] Error getting leaderboard:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get user profile - parameterized route comes LAST
router.get('/:id', async (req, res) => {
    try {
        const user = await db.prepare('SELECT id, username, avatar_id, level, xp, created_at FROM users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Get player stats
        const stats = await getPlayerStats(req.params.id);
        res.json({
            user: {
                ...user,
                stats
            }
        });
    }
    catch (error) {
        console.error('[Users] Error getting profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get user stats
router.get('/:id/stats', async (req, res) => {
    try {
        const stats = await getPlayerStats(req.params.id);
        res.json({ stats });
    }
    catch (error) {
        console.error('[Users] Error getting stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get user match history
router.get('/:id/history', async (req, res) => {
    try {
        const history = await getMatchHistory(req.params.id, 20);
        res.json({ history });
    }
    catch (error) {
        console.error('[Users] Error getting history:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get daily challenges
router.get('/:id/challenges', async (req, res) => {
    try {
        const challenges = await getDailyChallenges(req.params.id);
        res.json({ challenges });
    }
    catch (error) {
        console.error('[Users] Error getting challenges:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update challenge progress
router.post('/:id/challenges/:challengeId/progress', async (req, res) => {
    try {
        const { progress } = req.body;
        await updateChallengeProgress(req.params.id, req.params.challengeId, progress);
        const challenges = await getDailyChallenges(req.params.id);
        res.json({ challenges });
    }
    catch (error) {
        console.error('[Users] Error updating challenge:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
export { router as userRoutes };
