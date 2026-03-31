import express from 'express';
import { Message } from '../models/Message.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.get('/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user?.userId;
    const otherUserId = req.params.userId;

    if (!currentUserId || !otherUserId) {
      return res.status(400).json({ error: 'Missing user IDs' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

export default router;
