const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');

// Get this from Firebase Console → Project Settings → Cloud Messaging → Server key
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';

async function sendFcmPush(fcmToken, title, body) {
  if (!FCM_SERVER_KEY || !fcmToken) return;
  const payload = JSON.stringify({
    to: fcmToken,
    priority: 'high',
    notification: { title, body },
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path: '/fcm/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
    }, (res) => { res.resume(); resolve(); });
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const MONGO_URI = 'mongodb+srv://tanmoy:tanmoy123@tanmoy.dbot4ve.mongodb.net/FDO?appName=Tanmoy';
const DB_NAME = 'FDO';
const JWT_SECRET = 'fdo_jwt_secret_key_2024';
let db;

MongoClient.connect(MONGO_URI).then(client => {
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB Atlas - FDO');
}).catch(err => console.error('MongoDB connection error:', err));

function toObjectId(id) {
  try { return new ObjectId(id); } catch { return null; }
}

function docToJson(doc, idField = 'uid') {
  const { _id, ...rest } = doc;
  return { [idField]: _id.toString(), ...rest };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // support both hashed and legacy plaintext passwords
    let valid = false;
    if (user.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = user.password === password;
      // migrate to hashed on successful login
      if (valid) {
        const hashed = await bcrypt.hash(password, 10);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { password: hashed } });
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ uid: user._id.toString() }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _pw, ...safeUser } = docToJson(user);
    res.json({ ...safeUser, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({ name, email, password: hashed, role });
    const token = jwt.sign({ uid: result.insertedId.toString() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ uid: result.insertedId.toString(), name, email, role, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

app.get('/users/admin', async (req, res) => {
  try {
    const admin = await db.collection('users').findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const { password: _pw, ...safe } = docToJson(admin);
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/users', async (req, res) => {
  try {
    const users = await db.collection('users').find({ role: 'employee' }).toArray();
    res.json(users.map(u => { const { password, ...safe } = docToJson(u); return safe; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin adds a new employee
app.post('/users', async (req, res) => {
  try {
    const { name, email, password, department, phone, dateOfBirth, bloodGroup } = req.body;
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const dob = new Date(dateOfBirth);
    const dd = String(dob.getDate()).padStart(2, '0');
    const mm = String(dob.getMonth() + 1).padStart(2, '0');
    const yyyy = dob.getFullYear();
    const dobPart = `${dd}${mm}${yyyy}`;
    const count = await db.collection('users').countDocuments({ role: 'employee' });
    const serial = String(count + 1).padStart(3, '0');
    const employeeId = `EMP${dobPart}${serial}`;

    const hashed = await bcrypt.hash(password || 'Emp@1234', 10);
    const result = await db.collection('users').insertOne({
      name, email,
      password: hashed,
      role: 'employee',
      employeeId,
      department: department || null,
      phone: phone || null,
      dateOfBirth,
      bloodGroup: bloodGroup || null,
    });
    const inserted = await db.collection('users').findOne({ _id: result.insertedId });
    const { password: _pw, ...safeUser } = docToJson(inserted);
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/users/:uid', async (req, res) => {
  try {
    const oid = toObjectId(req.params.uid);
    const query = oid ? { _id: oid } : { _id: req.params.uid };
    const user = await db.collection('users').findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _pw, ...safeUser } = docToJson(user);
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Self profile update
app.put('/users/:uid', async (req, res) => {
  try {
    const oid = toObjectId(req.params.uid);
    const query = oid ? { _id: oid } : { _id: req.params.uid };
    const { _id, uid, password, ...fields } = req.body;
    if (password) fields.password = await bcrypt.hash(password, 10);
    await db.collection('users').updateOne(query, { $set: fields });
    const updated = await db.collection('users').findOne(query);
    const { password: _pw, ...safeUser } = docToJson(updated);
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin employee update (includes password reset)
app.put('/users/:uid/admin', async (req, res) => {
  try {
    const oid = toObjectId(req.params.uid);
    const query = oid ? { _id: oid } : { _id: req.params.uid };
    const { _id, uid, password, ...fields } = req.body;
    if (password) fields.password = await bcrypt.hash(password, 10);
    await db.collection('users').updateOne(query, { $set: fields });
    const updated = await db.collection('users').findOne(query);
    const { password: _pw, ...safeUser } = docToJson(updated);
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/users/:uid', async (req, res) => {
  try {
    const oid = toObjectId(req.params.uid);
    const query = oid ? { _id: oid } : { _id: req.params.uid };
    await db.collection('users').deleteOne(query);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/users/:uid/fcm-token', async (req, res) => {
  try {
    const oid = toObjectId(req.params.uid);
    const query = oid ? { _id: oid } : { _id: req.params.uid };
    await db.collection('users').updateOne(query, { $set: { fcmToken: req.body.token } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SSE Real-time Task Stream ─────────────────────────────────────────────────
const sseClients = new Map(); // uid -> res

app.get('/tasks/stream', (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial data
  const sendTasks = async () => {
    try {
      const filter = uid === 'admin' ? {} : { assignedTo: uid };
      const tasks = await db.collection('tasks').find(filter).sort({ createdAt: -1 }).toArray();
      const data = tasks.map(d => {
        const json = docToJson(d, 'id');
        json.updates = (d.updates || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        return json;
      });
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) { console.error('SSE error:', e.message); }
  };

  sendTasks();
  sseClients.set(uid, res);

  req.on('close', () => {
    sseClients.delete(uid);
    res.end();
  });
});

function notifyTaskChange(assignedTo) {
  // Notify the specific employee
  if (assignedTo && sseClients.has(assignedTo)) {
    const res = sseClients.get(assignedTo);
    db.collection('tasks').find({ assignedTo }).sort({ createdAt: -1 }).toArray().then(tasks => {
      const data = tasks.map(d => {
        const json = docToJson(d, 'id');
        json.updates = (d.updates || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        return json;
      });
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }).catch(() => {});
  }
  // Notify admin
  if (sseClients.has('admin')) {
    const res = sseClients.get('admin');
    db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray().then(tasks => {
      const data = tasks.map(d => {
        const json = docToJson(d, 'id');
        json.updates = (d.updates || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        return json;
      });
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }).catch(() => {});
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/tasks', async (req, res) => {
  try {
    const filter = req.query.assignedTo ? { assignedTo: req.query.assignedTo } : {};
    const tasks = await db.collection('tasks').find(filter).sort({ createdAt: -1 }).toArray();
    res.json(tasks.map(d => {
      const json = docToJson(d, 'id');
      json.updates = (d.updates || [])
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      return json;
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/tasks', async (req, res) => {
  try {
    const result = await db.collection('tasks').insertOne(req.body);
    const taskId = result.insertedId.toString();
    const assignedUid = req.body.assignedTo;

    // Notify EMPLOYEE only when task is assigned
    if (assignedUid) {
      const oid = toObjectId(assignedUid);
      const emp = await db.collection('users').findOne(oid ? { _id: oid } : { _id: assignedUid });
      if (emp) {
        const title = 'New Task Assigned';
        const body = `You have been assigned: "${req.body.title}"`;
        await db.collection('notifications').insertOne({
          userId: assignedUid, title, body,
          type: 'received', isRead: false,
          createdAt: new Date().toISOString(),
        });
        if (emp.fcmToken) await sendFcmPush(emp.fcmToken, title, body);
      }
    }
    notifyTaskChange(assignedUid);
    res.json({ id: taskId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const { _id, id, ...fields } = req.body;
    await db.collection('tasks').updateOne(query, { $set: fields });
    const updated = await db.collection('tasks').findOne(query);
    const json = docToJson(updated, 'id');
    json.updates = (updated.updates || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    notifyTaskChange(updated.assignedTo);
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/tasks/:id/status', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const { status } = req.body;
    await db.collection('tasks').updateOne(query, { $set: { status } });
    const task = await db.collection('tasks').findOne(query);

    // When task completed → notify ADMIN only
    if (status === 'completed' && task) {
      const admin = await db.collection('users').findOne({ role: 'admin' });
      if (admin) {
        const empOid = toObjectId(task.assignedTo);
        const emp = await db.collection('users').findOne(empOid ? { _id: empOid } : { _id: task.assignedTo });
        const empName = emp?.name ?? 'An employee';
        const title = 'Task Completed';
        const body = `${empName} has completed: "${task.title}"`;
        await db.collection('notifications').insertOne({
          userId: admin._id.toString(), title, body,
          type: 'received', isRead: false,
          createdAt: new Date().toISOString(),
        });
        if (admin.fcmToken) await sendFcmPush(admin.fcmToken, title, body);
      }
    }
    notifyTaskChange(task?.assignedTo);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/tasks/:id/updates', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const task = await db.collection('tasks').findOne(query);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json((task.updates || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/tasks/:id/updates', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const update = { ...req.body, date: new Date().toISOString() };
    await db.collection('tasks').updateOne(query, {
      $push: { updates: update },
      $set: { status: req.body.status },
    });
    const afterUpdate = await db.collection('tasks').findOne(query);
    notifyTaskChange(afterUpdate?.assignedTo);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const toDelete = await db.collection('tasks').findOne(query);
    await db.collection('tasks').deleteOne(query);
    notifyTaskChange(toDelete?.assignedTo);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/notifications', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.type) filter.type = req.query.type;
    const items = await db.collection('notifications').find(filter).sort({ createdAt: -1 }).toArray();
    res.json(items.map(d => docToJson(d, 'id')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/notifications', async (req, res) => {
  try {
    const result = await db.collection('notifications').insertOne(req.body);
    res.json({ id: result.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/notifications/check-deadlines', async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid required' });

    const tasks = await db.collection('tasks')
      .find({ assignedTo: uid, status: { $ne: 'completed' } })
      .toArray();

    const empOid = toObjectId(uid);
    const emp = await db.collection('users').findOne(empOid ? { _id: empOid } : { _id: uid });
    const admin = await db.collection('users').findOne({ role: 'admin' });

    const now = new Date();
    let sent = 0;

    for (const task of tasks) {
      const due = new Date(task.dueDate);
      const hoursLeft = (due - now) / (1000 * 60 * 60);
      const daysLeft = Math.floor(hoursLeft / 24);
      const isOverdue = due < now;
      const notifKey = `${task._id}_${isOverdue ? 'overdue' : daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : 'warning'}`;

      const alreadySent = await db.collection('sentDeadlineNotifs').findOne({ key: notifKey });
      if (alreadySent) continue;

      let empTitle, empBody, adminTitle, adminBody;

      if (isOverdue) {
        // OVERDUE → notify BOTH employee and admin
        empTitle = 'Task Overdue';
        empBody = `"${task.title}" is past its due date. Please update your status immediately.`;
        adminTitle = 'Task Overdue Alert';
        adminBody = `${emp?.name ?? 'An employee'}'s task "${task.title}" is overdue!`;
      } else if (daysLeft === 0 && hoursLeft <= 24) {
        // DUE TODAY → employee only
        empTitle = 'Due Today';
        empBody = `"${task.title}" is due today. Complete it as soon as possible!`;
      } else if (daysLeft === 1) {
        // DUE TOMORROW → employee only
        empTitle = 'Due Tomorrow';
        empBody = `"${task.title}" is due tomorrow. Make sure to finish it in time!`;
      } else if (daysLeft <= 3) {
        // APPROACHING → employee only
        empTitle = 'Deadline Approaching';
        empBody = `"${task.title}" is due in ${daysLeft} days. Stay on track!`;
      } else {
        continue;
      }

      // Notify employee
      if (emp && empTitle) {
        await db.collection('notifications').insertOne({
          userId: uid, title: empTitle, body: empBody,
          type: 'received', isRead: false, createdAt: new Date().toISOString(),
        });
        if (emp.fcmToken) await sendFcmPush(emp.fcmToken, empTitle, empBody);
      }

      // Notify admin (overdue only)
      if (admin && adminTitle) {
        await db.collection('notifications').insertOne({
          userId: admin._id.toString(), title: adminTitle, body: adminBody,
          type: 'received', isRead: false, createdAt: new Date().toISOString(),
        });
        if (admin.fcmToken) await sendFcmPush(admin.fcmToken, adminTitle, adminBody);
      }

      await db.collection('sentDeadlineNotifs').insertOne({ key: notifKey, sentAt: new Date() });
      sent++;
    }

    res.json({ sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/notifications/:id', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    await db.collection('notifications').deleteOne(query);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/notifications/:id/read', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    await db.collection('notifications').updateOne(query, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/notifications/:id', async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    const query = oid ? { _id: oid } : { _id: req.params.id };
    const { _id, id, ...fields } = req.body;
    await db.collection('notifications').updateOne(query, { $set: fields });
    const updated = await db.collection('notifications').findOne(query);
    res.json(docToJson(updated, 'id'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, '0.0.0.0', () => console.log('FDO backend running on http://0.0.0.0:3000'));
