import { Router, Request, Response } from 'express';
import { db, getPlayerStats, getMatchHistory, getLeaderboard, getDailyChallenges, updateChallengeProgress, getAchievements, checkAchievements } from '../db/index.js';


const router = Router();

// IMPORTANT: Mount specific routes BEFORE parameterized routes
// /leaderboard must come before /:id

// Get online players count - uses real socket connections from app.locals
router.get('/online/count', (req: Request, res: Response) => {

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
  } catch (error) {
    console.error('[Users] Error getting online count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard - MUST be before /:id
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Users] Error getting leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get user profile - parameterized route comes LAST
router.get('/:id', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('[Users] Error getting profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get user stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getPlayerStats(req.params.id);
    res.json({ stats });
  } catch (error) {
    console.error('[Users] Error getting stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get user match history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await getMatchHistory(req.params.id, 20);
    res.json({ history });
  } catch (error) {
    console.error('[Users] Error getting history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get daily challenges
router.get('/:id/challenges', async (req: Request, res: Response) => {
  try {
    const challenges = await getDailyChallenges(req.params.id);
    res.json({ challenges });
  } catch (error) {
    console.error('[Users] Error getting challenges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Update challenge progress
router.post('/:id/challenges/:challengeId/progress', async (req: Request, res: Response) => {
  try {
    const { progress } = req.body;
    await updateChallengeProgress(req.params.id, req.params.challengeId, progress);
    const challenges = await getDailyChallenges(req.params.id);
    res.json({ challenges });
  } catch (error) {
    console.error('[Users] Error updating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user achievements
router.get('/:id/achievements', async (req: Request, res: Response) => {
  try {
    const achievements = await getAchievements(req.params.id);
    res.json({ achievements });
  } catch (error) {
    console.error('[Users] Error getting achievements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check and unlock achievements
router.post('/:id/achievements/check', async (req: Request, res: Response) => {
  try {
    const unlocked = await checkAchievements(req.params.id);
    const achievements = await getAchievements(req.params.id);
    res.json({ achievements, newlyUnlocked: unlocked });
  } catch (error) {
    console.error('[Users] Error checking achievements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get user settings
router.get('/:id/settings', async (req: Request, res: Response) => {
  try {
    const user = await db.prepare('SELECT settings FROM users WHERE id = ?').get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Parse settings from JSON or return defaults
    let settings = {};
    try {
      settings = user.settings ? JSON.parse(user.settings) : {};
    } catch (e) {
      settings = {};
    }
    
    res.json({ settings });
  } catch (error) {
    console.error('[Users] Error getting settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user settings
router.put('/:id/settings', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings data' });
    }
    
    // Get existing settings and merge
    const user = await db.prepare('SELECT settings FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    let existingSettings = {};
    try {
      existingSettings = user.settings ? JSON.parse(user.settings) : {};
    } catch (e) {
      existingSettings = {};
    }
    
    // Merge new settings with existing
    const mergedSettings = { ...existingSettings, ...settings };
    
    // Save back to database
    await db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(
      JSON.stringify(mergedSettings),
      req.params.id
    );
    
    res.json({ settings: mergedSettings });
  } catch (error) {
    console.error('[Users] Error updating settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


export { router as userRoutes };
