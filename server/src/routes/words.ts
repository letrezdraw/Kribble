import { Router, Request, Response } from 'express';
import { getWordsByCategory, getWordCategories } from '../db/index.js';

const router = Router();

// Get all word categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await getWordCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get words (optionally filtered by category)
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const words = await getWordsByCategory(category);
    res.json({ words });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export { router as wordRoutes };
