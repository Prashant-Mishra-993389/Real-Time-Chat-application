import express from 'express';
import { User } from '../models/User.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { username } = req.query;
    const currentUserId = req.user?.userId;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username query parameter is required' });
    }

    const users = await User.find({
      username: { $regex: username, $options: 'i' },
      _id: { $ne: currentUserId }, // Exclude current user
    }).select('username publicKey _id');

    res.json(users);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Server error during user search' });
  }
});

// Get recent chat users
router.get('/recent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user?.userId;
    
    // In a real app, we'd query messages to find recent contacts.
    // For simplicity, let's just return all users except current for now,
    // or ideally, we should implement a proper recent chats query.
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('username publicKey _id')
      .limit(20);
      
    res.json(users);
  } catch (error) {
    console.error('Recent users error:', error);
    res.status(500).json({ error: 'Server error fetching recent users' });
  }
});

export default router;
