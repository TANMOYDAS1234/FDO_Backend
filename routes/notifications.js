const router = require('express').Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');

const format = (n) => ({
  id: n._id.toString(),
  title: n.title,
  body: n.body,
  userId: n.userId.toString(),
  isRead: n.isRead,
  createdAt: n.createdAt.toISOString(),
});

// GET /notifications/:userId
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const notes = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notes.map(format));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
