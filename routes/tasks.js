const router = require('express').Router();
const Task = require('../models/Task');
const authMiddleware = require('../middleware/auth');

const formatTask = (t) => ({
  id: t._id.toString(),
  title: t.title,
  description: t.description,
  assignedTo: t.assignedTo.toString(),
  assignedBy: t.assignedBy.toString(),
  status: t.status,
  dueDate: t.dueDate.toIso8601String ? t.dueDate.toIso8601String() : t.dueDate.toISOString(),
  createdAt: t.createdAt.toISOString(),
  updates: (t.updates || []).map(u => ({
    note: u.note,
    status: u.status,
    date: u.date ? u.date.toISOString() : new Date().toISOString(),
  })),
});

// GET /tasks — all tasks (admin) or by userId (employee)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = req.query.assignedTo ? { assignedTo: req.query.assignedTo } : {};
    const tasks = await Task.find(filter).sort({ dueDate: 1 });
    res.json(tasks.map(formatTask));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /tasks — create task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, assignedTo, assignedBy, dueDate } = req.body;
    const task = await Task.create({ title, description, assignedTo, assignedBy, dueDate });
    res.json(formatTask(task));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /tasks/:id — admin updates task
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, assignedTo, dueDate, status },
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(formatTask(task));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /tasks/:id/status — update status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(formatTask(task));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /tasks/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /tasks/:id/updates
router.get('/:id/updates', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json((task.updates || []).map(u => ({
      note: u.note,
      status: u.status,
      date: u.date ? u.date.toISOString() : new Date().toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /tasks/:id/updates — employee submits daily update
router.post('/:id/updates', authMiddleware, async (req, res) => {
  try {
    const { note, status, date } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { updates: { $each: [{ note, status, date }], $position: 0 } }, status },
      { new: true },
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(formatTask(task));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;