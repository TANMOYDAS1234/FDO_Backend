const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'ems-app-e55db',
  private_key_id: '30879b84beab5b4870efe8b9950f88ad7faa9688',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFtpLolSf1jm5i\nqhcCIhIqVLGNKsw2+2eD9kO3dD1l3gQHREr5Uc022hFAdkbJq9qTWUOZhOWhmkD7\nwondlckmcg6ym7j8ofWQEOl3lUpBszhuBr0FVoSZWH7ai/48iLqsYsTjzfW7ucfK\nkVgEo6n/IrudBpZK5YqD8oF6xESJlCzaC/X4OWjS2J05z7LYP0548jjI1Vm76K/o\nwUsnz/fQSlV0BpK7G/yVp9Vuf1MKMnRcXNTXIDj14f+4Fp3duczlTb0Ylcnm4gl6\nQDz/k5tJxM6aZ0yMgiVqsWFXTBqFoyHWNLjeq08UA/NDnRoiWHw4IbJaZ9JSEKZ7\nY+QtLoNRAgMBAAECggEAYZKrx7qsoMPs+CZG+peD7X4kra1cYRoLSRXE74mfL2G1\nDT0H3ykepJ5T+0Mjxi1YznU0JlRu2yT8QwML9N4SCjYpyL2POqZXQQUHoyt7HRds\nlugear76646/8+04x/kWXzLTRjWDu2SBFBhMnuWCZNZoTqNMkqPbiyin+8VWqaon\nfNj5pJCR9xAzCd+ltKjim1/GYceh7ZSwA8Ao6V/rDuwp66XgVoqFZfKHMVNAJE29\nsVqkIw/CihUearn49V3dTNsUMKUnUa3IjB707rHh5dibEuBOFnsDPK/iqwazv+2t\nc6IwHArTENYtzS+DtRnvwcPZRxPS+6dGWdxbbjzFvQKBgQDrO2sCXsfQFWK5pt1J\njJ8VC04Ga4VXxegUhiWbBmnTMvDsbxLKKryYknc/r88URb69S01jcu5wCTdKh7Mp\nhoph7ugGZq6CNh9OWvYyRmpy3MTANFw+emrazvxnLxwThTNy2kc1H3wdePkifTXL\nomn+eg0WVANYoUUeZGUI0UhpbwKBgQDXKyyukSemJrkQaa4FDi8JEpEJO6InS4lg\nT5Yuhf59lxgyz1YrQz+YkL69dtzgBL9uediyo23zflMFCdKgF8c9usT45D/Bh6P+\nnZRbXZ2Rw0uTTl+1N39Ke+UbQD8ruyCz++gqgGbePvCELVh5d1zAHxN0GftQZr8m\n+kgZ+Jn/PwKBgQDcLqHbdhxSCbJ/VFGNprLBX/OIztvhbL3veCF7GmWz6trYdJ+B\n3L7rkS1Nz6Jlt2LyjKnDjLDi7b1zZdGt7OFbCeTlGPf/qeljzoDkTkUVftArmNc/\nJBcg+N4JN29wVh3yQ56jevUSIUoRnmHcWgocyOG3JKx9KXcpG4/20O6WwQKBgQCR\nGJo+9b+I+Z/eg4VH/3KUaaLIWSBV40g2XDToFo+w3U0CJnLzJZwjI6icVyVHI6x7\nsUsB29dvVYZiZWdVcfN3mxTsye58cR2Tu2up2Q1CmDHEmhtMNqpt7fJnWAHBWaUJ\n+htrXb8Aq+zBFVsOPgGbxNj3d/XTGBZbEHfCm7QtPQKBgDWWo8jA8xrXmYcwE2+a\nj+FhrxKFAvf+bmR3C3acn1TGhadPtN/9IYoqUFpjMrtqQ+1AC48Umt6nWcude2cM\neFPk808xyrS6Gbuk5d5XUzaedFBwUjqUxlC0Y4hMgozuWJYwMIHQR7NwyauBmWcq\nMUTQ5gyiQl2WMj/PVGuPoC6z\n-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk-fbsvc@ems-app-e55db.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
};

const _fcmAuth = new GoogleAuth({
  credentials: SERVICE_ACCOUNT,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});

async function sendFcmPush(fcmToken, title, body) {
  if (!fcmToken) return;
  try {
    const accessToken = await _fcmAuth.getAccessToken();
    const payload = JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'fdo_tasks',
            notification_priority: 'PRIORITY_MAX',
            visibility: 'PUBLIC',
          },
        },
      },
    });
    await new Promise((resolve) => {
      const req = https.request({
        hostname: 'fcm.googleapis.com',
        path: '/v1/projects/ems-app-e55db/messages:send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          if (res.statusCode !== 200) console.error('FCM error:', res.statusCode, data);
          resolve();
        });
      });
      req.on('error', (e) => { console.error('FCM request error:', e.message); resolve(); });
      req.write(payload);
      req.end();
    });
  } catch (e) { console.error('sendFcmPush failed:', e.message); }
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

// ── SSE Real-time Notification Stream ────────────────────────────────────────
const notifClients = new Map(); // uid -> res

app.get('/notifications/stream', (req, res) => {
  const uid = req.query.userId;
  if (!uid) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send current unread count immediately on connect
  db.collection('notifications')
    .find({ userId: uid, type: 'received', isRead: false })
    .toArray()
    .then(items => {
      res.write(`data: ${JSON.stringify({ unread: items.length, notifications: items.map(d => docToJson(d, 'id')) })}\n\n`);
    }).catch(() => {});

  notifClients.set(uid, res);
  req.on('close', () => { notifClients.delete(uid); res.end(); });
});

function pushNotifUpdate(uid) {
  if (!notifClients.has(uid)) return;
  const res = notifClients.get(uid);
  db.collection('notifications')
    .find({ userId: uid, type: 'received' })
    .sort({ createdAt: -1 })
    .toArray()
    .then(items => {
      const unread = items.filter(i => !i.isRead).length;
      res.write(`data: ${JSON.stringify({ unread, notifications: items.map(d => docToJson(d, 'id')) })}\n\n`);
    }).catch(() => {});
}

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
        pushNotifUpdate(assignedUid);
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
        pushNotifUpdate(admin._id.toString());
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

    // If completed via daily update → notify ADMIN only
    if (req.body.status === 'completed' && afterUpdate) {
      const admin = await db.collection('users').findOne({ role: 'admin' });
      if (admin) {
        const empOid = toObjectId(afterUpdate.assignedTo);
        const emp = await db.collection('users').findOne(empOid ? { _id: empOid } : { _id: afterUpdate.assignedTo });
        const empName = emp?.name ?? 'An employee';
        const title = 'Task Completed';
        const body = `${empName} has completed: "${afterUpdate.title}"`;
        await db.collection('notifications').insertOne({
          userId: admin._id.toString(), title, body,
          type: 'received', isRead: false,
          createdAt: new Date().toISOString(),
        });
        if (admin.fcmToken) await sendFcmPush(admin.fcmToken, title, body);
        pushNotifUpdate(admin._id.toString());
      }
    }

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
    // Push SSE update to recipient if they're connected
    if (req.body.userId && req.body.type === 'received') {
      pushNotifUpdate(req.body.userId);
    }
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
        pushNotifUpdate(uid);
      }

      // Notify admin (overdue only)
      if (admin && adminTitle) {
        await db.collection('notifications').insertOne({
          userId: admin._id.toString(), title: adminTitle, body: adminBody,
          type: 'received', isRead: false, createdAt: new Date().toISOString(),
        });
        if (admin.fcmToken) await sendFcmPush(admin.fcmToken, adminTitle, adminBody);
        pushNotifUpdate(admin._id.toString());
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

app.listen(3000, '0.0.0.0', () => {
  console.log('FDO backend running on http://0.0.0.0:3000');
  // Run deadline check every hour for all employees automatically
  setInterval(async () => {
    try {
      const employees = await db.collection('users').find({ role: 'employee' }).toArray();
      for (const emp of employees) {
        const uid = emp._id.toString();
        const tasks = await db.collection('tasks')
          .find({ assignedTo: uid, status: { $ne: 'completed' } })
          .toArray();
        const admin = await db.collection('users').findOne({ role: 'admin' });
        const now = new Date();
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
            empTitle = 'Task Overdue'; empBody = `"${task.title}" is past its due date.`;
            adminTitle = 'Task Overdue Alert'; adminBody = `${emp.name}'s task "${task.title}" is overdue!`;
          } else if (daysLeft === 0 && hoursLeft <= 24) {
            empTitle = 'Due Today'; empBody = `"${task.title}" is due today!`;
          } else if (daysLeft === 1) {
            empTitle = 'Due Tomorrow'; empBody = `"${task.title}" is due tomorrow.`;
          } else if (daysLeft <= 3) {
            empTitle = 'Deadline Approaching'; empBody = `"${task.title}" is due in ${daysLeft} days.`;
          } else { continue; }
          if (empTitle) {
            await db.collection('notifications').insertOne({ userId: uid, title: empTitle, body: empBody, type: 'received', isRead: false, createdAt: new Date().toISOString() });
            if (emp.fcmToken) await sendFcmPush(emp.fcmToken, empTitle, empBody);
            pushNotifUpdate(uid);
          }
          if (admin && adminTitle) {
            await db.collection('notifications').insertOne({ userId: admin._id.toString(), title: adminTitle, body: adminBody, type: 'received', isRead: false, createdAt: new Date().toISOString() });
            if (admin.fcmToken) await sendFcmPush(admin.fcmToken, adminTitle, adminBody);
            pushNotifUpdate(admin._id.toString());
          }
          await db.collection('sentDeadlineNotifs').insertOne({ key: notifKey, sentAt: new Date() });
        }
      }
      console.log('[CRON] Deadline check completed');
    } catch (e) { console.error('[CRON] Deadline check error:', e.message); }
  }, 60 * 60 * 1000); // every 1 hour
});
