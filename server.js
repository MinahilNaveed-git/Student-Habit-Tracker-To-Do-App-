const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'studyflow_super_secret_key_123';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the same directory
app.use(express.static(__dirname));

// Initialize SQLite Database
const dbPath = path.resolve(__dirname, 'studyflow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log("Connected to the SQLite database.");
    
    // Create Tables
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      major TEXT,
      year TEXT,
      avatar TEXT,
      theme TEXT DEFAULT 'light',
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT,
      color TEXT,
      icon TEXT,
      userId TEXT
    )`, () => {
      // Migration: Add userId column if it doesn't exist
      db.run("ALTER TABLE subjects ADD COLUMN userId TEXT", () => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      subjectId TEXT,
      priority TEXT,
      dueDate TEXT,
      estTime REAL,
      status TEXT,
      desc TEXT,
      notes TEXT,
      created TEXT,
      userId TEXT
    )`, () => {
      // Migration: Add userId column if it doesn't exist
      db.run("ALTER TABLE tasks ADD COLUMN userId TEXT", () => {});
    });

    // Migration for activity table to support multi-user schema
    db.all("PRAGMA table_info(activity)", (err, rows) => {
      if (err) return;
      const hasUserId = rows && rows.some(row => row.name === 'userId');
      if (!hasUserId) {
        // Drop old table count by date and recreate with composite key (userId, date)
        db.run("DROP TABLE IF EXISTS activity", () => {
          db.run(`CREATE TABLE IF NOT EXISTS activity (
            userId TEXT,
            date TEXT,
            count INTEGER,
            PRIMARY KEY (userId, date)
          )`);
        });
      } else {
        db.run(`CREATE TABLE IF NOT EXISTS activity (
          userId TEXT,
          date TEXT,
          count INTEGER,
          PRIMARY KEY (userId, date)
        )`);
      }
    });
  }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = decoded;
    next();
  });
}

// Auth API Endpoints

// A. POST /api/auth/register - Register a student
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, major, year } = req.body;
  if (!email || !password || !name || !major || !year) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  // Check if email already registered
  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: "Email is already registered." });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = 'usr_' + Date.now();
      const created = new Date().toISOString();
      
      // Compute initials for avatar
      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SF';

      const sql = 'INSERT INTO users (id, email, password, name, major, year, avatar, theme, created_at) VALUES (?,?,?,?,?,?,?,?,?)';
      db.run(sql, [userId, email.toLowerCase(), hashedPassword, name, major, year, initials, 'light', created], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Generate Token
        const token = jwt.sign({ id: userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
          token,
          user: { id: userId, email: email.toLowerCase(), name, major, year, avatar: initials, theme: 'light' }
        });
      });
    } catch (e) {
      res.status(500).json({ error: "Password encryption failed." });
    }
  });
});

// B. POST /api/auth/login - Login a student
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "Invalid email or password." });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid email or password." });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        major: user.major,
        year: user.year,
        avatar: user.avatar,
        theme: user.theme || 'light'
      }
    });
  });
});

// C. GET /api/auth/me - Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, name, major, year, avatar, theme FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  });
});

// D. PUT /api/auth/profile - Update student profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, major, year, password } = req.body;
  const userId = req.user.id;

  const updates = [];
  const values = [];

  if (name) {
    updates.push("name = ?");
    values.push(name);
    // update avatar initials
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SF';
    updates.push("avatar = ?");
    values.push(initials);
  }
  if (major) { updates.push("major = ?"); values.push(major); }
  if (year) { updates.push("year = ?"); values.push(year); }
  if (password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      values.push(hashedPassword);
    } catch (e) {
      return res.status(500).json({ error: "Hashing failed." });
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No update fields provided." });
  }

  values.push(userId);
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  db.run(sql, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Fetch updated user data
    db.get('SELECT id, email, name, major, year, avatar, theme FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, user });
    });
  });
});

// E. PUT /api/auth/theme - Update user theme settings
app.put('/api/auth/theme', authenticateToken, (req, res) => {
  const { theme } = req.body;
  const userId = req.user.id;
  db.run('UPDATE users SET theme = ? WHERE id = ?', [theme, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});


// Secured API Endpoints (All require authentication)

// 1. GET /api/data - Get subjects, tasks, and activity for the authenticated user
app.get('/api/data', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const result = {
    subjects: [],
    tasks: [],
    activity: { history: [] }
  };

  db.all('SELECT id, name, color, icon FROM subjects WHERE userId = ?', [userId], (err, subjects) => {
    if (err) return res.status(500).json({ error: err.message });
    result.subjects = subjects || [];

    db.all('SELECT * FROM tasks WHERE userId = ?', [userId], (err, tasks) => {
      if (err) return res.status(500).json({ error: err.message });
      result.tasks = tasks || [];

      db.all('SELECT date, count FROM activity WHERE userId = ?', [userId], (err, activities) => {
        if (err) return res.status(500).json({ error: err.message });
        result.activity.history = activities || [];
        res.json(result);
      });
    });
  });
});

// 2. POST /api/subjects - Add a subject
app.post('/api/subjects', authenticateToken, (req, res) => {
  const { id, name, color, icon } = req.body;
  const userId = req.user.id;
  const sql = 'INSERT INTO subjects (id, name, color, icon, userId) VALUES (?,?,?,?,?)';
  db.run(sql, [id, name, color, icon, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, name, color, icon });
  });
});

// 3. POST /api/tasks - Add a task
app.post('/api/tasks', authenticateToken, (req, res) => {
  const { id, title, subjectId, priority, dueDate, estTime, status, desc, notes, created } = req.body;
  const userId = req.user.id;
  const sql = 'INSERT INTO tasks (id, title, subjectId, priority, dueDate, estTime, status, desc, notes, created, userId) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
  db.run(sql, [id, title, subjectId, priority, dueDate, estTime, status, desc, notes, created, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(req.body);
  });
});

// 4. PUT /api/tasks/:id - Update a task (secured)
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Build dynamic update query
  const updates = [];
  const values = [];
  for (const [key, value] of Object.entries(req.body)) {
    // Avoid updating database id or userId via body
    if (key !== 'id' && key !== 'userId') {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) return res.json({ success: true });

  values.push(id);
  values.push(userId);
  const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND userId = ?`;
  
  db.run(sql, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// 5. DELETE /api/tasks/:id - Delete a task (secured)
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const sql = 'DELETE FROM tasks WHERE id = ? AND userId = ?';
  db.run(sql, [id, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// 6. POST /api/activity - Log activity (secured)
app.post('/api/activity', authenticateToken, (req, res) => {
  const { date } = req.body;
  const userId = req.user.id;
  
  // Check if date exists for this user
  db.get('SELECT count FROM activity WHERE userId = ? AND date = ?', [userId, date], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      db.run('UPDATE activity SET count = count + 1 WHERE userId = ? AND date = ?', [userId, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: row.count + 1 });
      });
    } else {
      db.run('INSERT INTO activity (userId, date, count) VALUES (?, ?, 1)', [userId, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: 1 });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`StudyFlow backend server is running on http://localhost:${PORT}`);
});

