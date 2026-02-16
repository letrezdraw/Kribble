import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

const router = Router();

// JWT secret (would be from environment in production)
const JWT_SECRET = process.env.JWT_SECRET || 'kribble-secret-key';

// Register
router.post('/register', async (req: Request, res: Response) => {
  console.log('[Auth] Register request received:', req.body);
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      console.log('[Auth] Register failed: Missing fields');
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ message: 'Username must be 3-20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    console.log('[Auth] Checking for existing user...');
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      console.log('[Auth] Register failed: User already exists');
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    console.log('[Auth] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    console.log('[Auth] Creating user with ID:', userId);
    await db.prepare(`
      INSERT INTO users (id, username, email, password, avatar_id, level, xp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, hashedPassword, '👤', 1, 0);

    // Generate token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    console.log('[Auth] User registered successfully:', username);
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
    console.error('[Auth] Register error:', error);
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});


// Login
router.post('/login', async (req: Request, res: Response) => {
  console.log('[Auth] Login request received:', req.body.email);
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    console.log('[Auth] Looking up user...');
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
      console.log('[Auth] Login failed: User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    console.log('[Auth] Checking password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('[Auth] Login failed: Invalid password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    console.log('[Auth] User logged in successfully:', user.username);
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
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});


// Get current user
router.get('/me', async (req: Request, res: Response) => {
  console.log('[Auth] /me request received');
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    console.log('[Auth] Looking up user by token:', decoded.userId);
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
    console.error('[Auth] /me error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});


// Guest login - create temporary user
router.post('/guest', async (req: Request, res: Response) => {
  console.log('[Auth] Guest login request received');
  try {
    const { username } = req.body;

    // Generate guest username if not provided
    const guestUsername = username?.trim() || `Guest${Math.floor(Math.random() * 10000)}`;
    const userId = uuidv4();
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    console.log('[Auth] Creating guest user:', guestUsername);
    
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
        console.log('[Auth] Guest columns not found, using basic insert');
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

    console.log('[Auth] Guest user created successfully:', guestUsername);
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
    console.error('[Auth] Guest login error:', error);
    res.status(500).json({ message: 'Server error', details: String(error) });
  }
});



// Update profile
router.put('/profile', async (req: Request, res: Response) => {
  console.log('[Auth] Profile update request received');
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
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
    console.error('[Auth] Profile update error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});


// Cleanup expired guest users
async function cleanupExpiredGuests() {
  try {
    console.log('[Auth] Cleaning up expired guest users...');
    
    // Find expired guest users
    const expiredGuests = await db.prepare(`
      SELECT id FROM users 
      WHERE is_guest = TRUE AND expires_at < CURRENT_TIMESTAMP
    `).all() as { id: string }[];
    
    if (expiredGuests.length === 0) {
      console.log('[Auth] No expired guest users found');
      return;
    }
    
    console.log(`[Auth] Found ${expiredGuests.length} expired guest users`);
    
    // Delete expired guests (cascade will handle related data)
    for (const guest of expiredGuests) {
      await db.prepare('DELETE FROM users WHERE id = ?').run(guest.id);
      console.log(`[Auth] Deleted expired guest user: ${guest.id}`);
    }
    
    console.log(`[Auth] Cleaned up ${expiredGuests.length} expired guest users`);
  } catch (error) {
    console.error('[Auth] Error cleaning up guest users:', error);
  }
}


export { router as authRoutes, cleanupExpiredGuests };
