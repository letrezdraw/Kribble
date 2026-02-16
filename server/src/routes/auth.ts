import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';


const router = Router();

// JWT secret (would be from environment in production)
const JWT_SECRET = process.env.JWT_SECRET || 'kribble-secret-key';

// Register
router.post('/register', async (req: Request, res: Response) => {
  logger.userAction('anonymous', 'REGISTER_ATTEMPT', { email: req.body.email, username: req.body.username }, req.ip);
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      logger.warn('AUTH', 'Register failed: Missing fields', { body: req.body });
      return res.status(400).json({ message: 'All fields are required' });
    }


    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ message: 'Username must be 3-20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    logger.trace('AUTH', 'Checking for existing user', { email, username });
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      logger.warn('AUTH', 'Register failed: User already exists', { email, username });
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    logger.trace('AUTH', 'Hashing password', { email });
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    logger.trace('AUTH', 'Creating user', { userId, email, username });

    await db.prepare(`
      INSERT INTO users (id, username, email, password, avatar_id, level, xp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, hashedPassword, '👤', 1, 0);

    // Generate token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    logger.userAction(userId, 'REGISTER_SUCCESS', { username, email }, req.ip);
    res.status(201).json({

      token,
      user: {
        id: userId,
        username,
        email,
        avatarId: '👤',
        level: 1,
        xp: 0,
      },
    });
  } catch (error) {
    logger.error('AUTH', 'Register error', error as Error, { body: req.body });
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});



// Login
router.post('/login', async (req: Request, res: Response) => {
  logger.userAction('anonymous', 'LOGIN_ATTEMPT', { email: req.body.email }, req.ip);
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      logger.warn('AUTH', 'Login failed: Missing fields');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    logger.trace('AUTH', 'Looking up user', { email });

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
      id: string;
      username: string;
      email: string;
      password: string;
      avatar_id: string;
      level: number;
      xp: number;
    } | undefined;

    if (!user) {
      logger.warn('AUTH', 'Login failed: User not found', { email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    logger.trace('AUTH', 'Checking password', { userId: user.id });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn('AUTH', 'Login failed: Invalid password', { userId: user.id, email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    logger.userAction(user.id, 'LOGIN_SUCCESS', { username: user.username, email }, req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarId: user.avatar_id,
        level: user.level,
        xp: user.xp,
      },
    });
  } catch (error) {
    logger.error('AUTH', 'Login error', error as Error, { body: req.body });
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});



// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    logger.trace('AUTH', '/me lookup', { userId: decoded.userId });

    const user = await db.prepare('SELECT id, username, email, avatar_id, level, xp FROM users WHERE id = ?').get(decoded.userId) as {
      id: string;
      username: string;
      email: string;
      avatar_id: string;
      level: number;
      xp: number;
    } | undefined;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarId: user.avatar_id,
        level: user.level,
        xp: user.xp,
      },
    });
  } catch (error) {
    logger.error('AUTH', '/me error', error as Error);
    res.status(401).json({ message: 'Invalid token' });
  }
});



// Guest login - create temporary user
router.post('/guest', async (req: Request, res: Response) => {
  logger.userAction('anonymous', 'GUEST_LOGIN_ATTEMPT', { username: req.body.username }, req.ip);
  try {

    const { username } = req.body;

    // Generate guest username if not provided
    const guestUsername = username?.trim() || `Guest${Math.floor(Math.random() * 10000)}`;
    const userId = uuidv4();
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    logger.trace('AUTH', 'Creating guest user', { userId, guestUsername });

    
    // Try to create guest user with all columns (including is_guest and expires_at)
    // Use empty string for email to satisfy NOT NULL constraint in PostgreSQL
    const guestEmail = `guest-${userId}@kribble.local`;
    try {
      await db.prepare(`
        INSERT INTO users (id, username, email, password, avatar_id, level, xp, is_guest, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, guestUsername, guestEmail, '', '👤', 1, 0, true, expiresAt.toISOString());
    } catch (insertError: any) {
      // If columns don't exist, fall back to basic insert without guest columns
      if (insertError.message?.includes('is_guest') || insertError.message?.includes('expires_at') || 
          insertError.message?.includes('column') || insertError.message?.includes('no such column')) {
        logger.warn('AUTH', 'Guest columns not found, using basic insert');
        await db.prepare(`

          INSERT INTO users (id, username, email, password, avatar_id, level, xp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, guestUsername, guestEmail, '', '👤', 1, 0);
      } else {
        throw insertError;
      }
    }


    // Generate token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' });

    logger.userAction(userId, 'GUEST_LOGIN_SUCCESS', { username: guestUsername }, req.ip);
    res.status(201).json({

      token,
      user: {
        id: userId,
        username: guestUsername,
        email: null,
        avatarId: '👤',
        level: 1,
        xp: 0,
        isGuest: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('AUTH', 'Guest login error', error as Error, { body: req.body });
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});




// Update profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    logger.userAction(decoded.userId, 'PROFILE_UPDATE', { updates: req.body }, req.ip);

    const { username, avatarId } = req.body;

    // Update user
    if (username) {
      await db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, decoded.userId);
    }
    if (avatarId) {
      await db.prepare('UPDATE users SET avatar_id = ? WHERE id = ?').run(avatarId, decoded.userId);
    }

    // Get updated user
    const user = await db.prepare('SELECT id, username, email, avatar_id, level, xp FROM users WHERE id = ?').get(decoded.userId) as {
      id: string;
      username: string;
      email: string;
      avatar_id: string;
      level: number;
      xp: number;
    };

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarId: user.avatar_id,
        level: user.level,
        xp: user.xp,
      },
    });
  } catch (error) {
    logger.error('AUTH', 'Profile update error', error as Error);
    res.status(401).json({ message: 'Invalid token' });
  }
});



// Cleanup expired guest users
async function cleanupExpiredGuests() {
  try {
    logger.info('AUTH', 'Cleaning up expired guest users');
    
    // Find expired guest users
    const expiredGuests = await db.prepare(`
      SELECT id FROM users 
      WHERE is_guest = TRUE AND expires_at < CURRENT_TIMESTAMP
    `).all() as { id: string }[];
    
    if (expiredGuests.length === 0) {
      logger.trace('AUTH', 'No expired guest users found');
      return;
    }
    
    logger.info('AUTH', `Found ${expiredGuests.length} expired guest users`);
    
    // Delete expired guests (cascade will handle related data)
    for (const guest of expiredGuests) {
      await db.prepare('DELETE FROM users WHERE id = ?').run(guest.id);
      logger.trace('AUTH', 'Deleted expired guest user', { userId: guest.id });
    }
    
    logger.info('AUTH', `Cleaned up ${expiredGuests.length} expired guest users`);
  } catch (error) {
    logger.error('AUTH', 'Error cleaning up guest users', error as Error);
  }
}



export { router as authRoutes, cleanupExpiredGuests };
