const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dbLib = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DUE_DAYS = 14;
const FINE_PER_DAY = 5; // in rupees
const SESSION_COOKIE = 'lms_session';
const sessions = new Map();

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- Session & Auth Helpers ----------
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE] || null;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function toSafeUser(user) {
  if (!user) return null;
  const { password: _pw, ...safeUser } = user;
  return safeUser;
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const sess = sessions.get(token);
  const user = dbLib.get(
    `SELECT id, name, email, role, membership_status, student_id, created_at
     FROM users WHERE id = ?`,
    [sess.userId]
  );
  if (!user) {
    sessions.delete(token);
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (user.membership_status !== 'active') {
    sessions.delete(token);
    clearSessionCookie(res);
    return res.status(403).json({ error: 'Account membership is not active' });
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

function requireActiveStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  if (req.user.membership_status !== 'active') {
    return res.status(403).json({ error: 'Membership is not active' });
  }
  next();
}

function requireLibrarian(req, res, next) {
  if (req.user.role !== 'librarian') {
    return res.status(403).json({ error: 'Librarian access required' });
  }
  next();
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = dbLib.get('SELECT * FROM users WHERE lower(email) = ?', [email.trim().toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.membership_status === 'pending') {
    return res.status(403).json({
      error: 'Your registration is pending librarian verification. You can log in once approved.',
      membership_status: 'pending'
    });
  }
  if (user.membership_status === 'rejected') {
    return res.status(403).json({
      error: 'Your registration was rejected by the librarian. Library access is denied.',
      membership_status: 'rejected'
    });
  }
  if (user.membership_status !== 'active') {
    return res.status(403).json({ error: 'Your membership is not active' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, createdAt: Date.now() });
  setSessionCookie(res, token);
  res.json(toSafeUser(user));
});

app.post('/api/logout', (req, res) => {
  const token = getTokenFromReq(req);
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// ---------- Student Self-Registration ----------
app.post('/api/register', (req, res) => {
  const body = req.body || {};

  // Never allow callers to self-assign librarian or arbitrary roles
  if (body.role !== undefined && body.role !== 'student') {
    return res.status(403).json({ error: 'Only student self-registration is permitted' });
  }

  const { name, studentId, email, password, confirmPassword } = body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanStudentId = typeof studentId === 'string' ? studentId.trim().toUpperCase() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || !cleanStudentId || !cleanEmail || typeof password !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (cleanName.length < 2 || cleanName.length > 100) {
    return res.status(400).json({ error: 'Full name must be between 2 and 100 characters' });
  }
  if (!/^[A-Z0-9._/-]{2,40}$/.test(cleanStudentId)) {
    return res.status(400).json({ error: 'University Student ID must be 2–40 valid characters (letters, numbers, -, _, ., /)' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 120) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password do not match' });
  }

  // Verify controlled authorized student ID
  const authRecord = dbLib.get(
    'SELECT * FROM authorized_student_ids WHERE upper(student_id) = ?',
    [cleanStudentId]
  );
  if (!authRecord) {
    return res.status(403).json({
      error: 'This University Student ID is not authorized for registration. Please contact the librarian.'
    });
  }
  if (authRecord.status === 'revoked') {
    return res.status(403).json({ error: 'This University Student ID has been revoked.' });
  }
  if (authRecord.status !== 'unused') {
    return res.status(409).json({ error: 'This University Student ID has already been used for registration.' });
  }

  // Prevent duplicate student ID or email in users table
  const dupStudentId = dbLib.get(
    'SELECT id FROM users WHERE upper(student_id) = ?',
    [cleanStudentId]
  );
  if (dupStudentId) {
    return res.status(409).json({ error: 'This University Student ID is already registered.' });
  }

  const dupEmail = dbLib.get(
    'SELECT id FROM users WHERE lower(email) = ?',
    [cleanEmail]
  );
  if (dupEmail) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 8);
  const createdAt = today();

  const newUserId = dbLib.transaction(() => {
    const insertedId = dbLib.insert(
      `INSERT INTO users (name, email, password, role, membership_status, student_id, created_at)
       VALUES (?, ?, ?, 'student', 'pending', ?, ?)`,
      [cleanName, cleanEmail, passwordHash, cleanStudentId, createdAt]
    );
    dbLib.run(
      `UPDATE authorized_student_ids SET status = 'used', used_by = ?, used_at = ? WHERE id = ?`,
      [insertedId, createdAt, authRecord.id]
    );
    return insertedId;
  });

  const createdUser = dbLib.get(
    `SELECT id, name, email, role, membership_status, student_id, created_at
     FROM users WHERE id = ?`,
    [newUserId]
  );

  res.status(201).json({
    message: 'Registration submitted! Your account is pending librarian verification.',
    user: createdUser
  });
});

// ---------- Book search & availability (FR2, FR3) ----------
app.get('/api/books', (req, res) => {
  const q = `%${(req.query.q || '').toLowerCase()}%`;
  const books = dbLib.all(
    `SELECT * FROM books WHERE lower(title) LIKE ? OR lower(author) LIKE ? OR isbn LIKE ?`,
    [q, q, `%${req.query.q || ''}%`]
  );
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  const book = dbLib.get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// ---------- Borrow request (FR4, FR5) ----------
app.post('/api/borrow', requireAuth, requireActiveStudent, (req, res) => {
  const { studentId: bodyStudentId, bookId } = req.body || {};
  if (bodyStudentId !== undefined && Number(bodyStudentId) !== req.user.id) {
    return res.status(403).json({ error: 'Cannot borrow on behalf of another student' });
  }
  const studentId = req.user.id;
  const book = dbLib.get('SELECT * FROM books WHERE id = ?', [bookId]);

  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.available_copies < 1) return res.status(409).json({ error: 'No copies available. Please reserve instead.' });

  const existing = dbLib.get(
    `SELECT * FROM transactions WHERE book_id=? AND student_id=? AND status IN ('pending','issued')`,
    [bookId, studentId]
  );
  if (existing) return res.status(409).json({ error: 'You already have a pending or active loan for this book' });

  const id = dbLib.insert(
    `INSERT INTO transactions (book_id, student_id, status, request_date) VALUES (?,?,?,?)`,
    [bookId, studentId, 'pending', today()]
  );
  res.json({ id, message: 'Borrow request submitted. Awaiting librarian approval.' });
});

// ---------- Reserve (FR9) ----------
app.post('/api/reserve', requireAuth, requireActiveStudent, (req, res) => {
  const { studentId: bodyStudentId, bookId } = req.body || {};
  if (bodyStudentId !== undefined && Number(bodyStudentId) !== req.user.id) {
    return res.status(403).json({ error: 'Cannot reserve on behalf of another student' });
  }
  const studentId = req.user.id;
  const book = dbLib.get('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const id = dbLib.insert(
    `INSERT INTO reservations (book_id, student_id, reserved_date, status) VALUES (?,?,?,?)`,
    [bookId, studentId, today(), 'waiting']
  );
  res.json({ id, message: 'Book reserved. You will be notified when it becomes available.' });
});

// ---------- Student dashboard ----------
app.get('/api/student/:id/dashboard', requireAuth, requireActiveStudent, (req, res) => {
  const studentId = Number(req.params.id);
  if (studentId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const loans = dbLib.all(
    `SELECT t.*, b.title, b.author FROM transactions t JOIN books b ON b.id = t.book_id
     WHERE t.student_id = ? ORDER BY t.id DESC`,
    [studentId]
  );
  const reservations = dbLib.all(
    `SELECT r.*, b.title, b.author FROM reservations r JOIN books b ON b.id = r.book_id
     WHERE r.student_id = ? ORDER BY r.id DESC`,
    [studentId]
  );
  const notifications = dbLib.all(
    `SELECT * FROM notifications WHERE student_id = ? ORDER BY id DESC LIMIT 10`,
    [studentId]
  );
  res.json({ loans, reservations, notifications });
});

// ---------- Librarian: pending requests (FR6) ----------
app.get('/api/librarian/requests', requireAuth, requireLibrarian, (req, res) => {
  const requests = dbLib.all(
    `SELECT t.*, b.title, u.name AS student_name FROM transactions t
     JOIN books b ON b.id = t.book_id JOIN users u ON u.id = t.student_id
     WHERE t.status = 'pending' ORDER BY t.id ASC`
  );
  res.json(requests);
});

app.post('/api/librarian/approve/:id', requireAuth, requireLibrarian, (req, res) => {
  const txn = dbLib.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
  if (!txn || txn.status !== 'pending') return res.status(400).json({ error: 'Request not found or already handled' });

  const book = dbLib.get('SELECT * FROM books WHERE id = ?', [txn.book_id]);
  if (book.available_copies < 1) return res.status(409).json({ error: 'No copies left to issue' });

  const issueDate = today();
  const dueDate = addDays(issueDate, DUE_DAYS);

  dbLib.run(`UPDATE transactions SET status='issued', issue_date=?, due_date=? WHERE id=?`, [issueDate, dueDate, txn.id]);
  dbLib.run(`UPDATE books SET available_copies = available_copies - 1 WHERE id=?`, [txn.book_id]);
  dbLib.run(`INSERT INTO notifications (student_id, message, created_at) VALUES (?,?,?)`, [
    txn.student_id,
    `Your request for "${book.title}" was approved. Due date: ${dueDate}.`,
    today(),
  ]);
  res.json({ message: 'Approved and issued', dueDate });
});

app.post('/api/librarian/reject/:id', requireAuth, requireLibrarian, (req, res) => {
  const txn = dbLib.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
  if (!txn || txn.status !== 'pending') return res.status(400).json({ error: 'Request not found or already handled' });
  dbLib.run(`UPDATE transactions SET status='rejected' WHERE id=?`, [txn.id]);
  const book = dbLib.get('SELECT * FROM books WHERE id = ?', [txn.book_id]);
  dbLib.run(`INSERT INTO notifications (student_id, message, created_at) VALUES (?,?,?)`, [
    txn.student_id,
    `Your request for "${book.title}" was rejected.`,
    today(),
  ]);
  res.json({ message: 'Request rejected' });
});

// ---------- Librarian: active issued loans + return & fine (FR8) ----------
app.get('/api/librarian/issued', requireAuth, requireLibrarian, (req, res) => {
  const rows = dbLib.all(
    `SELECT t.*, b.title, u.name AS student_name FROM transactions t
     JOIN books b ON b.id = t.book_id JOIN users u ON u.id = t.student_id
     WHERE t.status = 'issued' ORDER BY t.due_date ASC`
  );
  res.json(rows);
});

app.post('/api/librarian/return/:id', requireAuth, requireLibrarian, (req, res) => {
  const txn = dbLib.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
  if (!txn || txn.status !== 'issued') return res.status(400).json({ error: 'Loan not found or not currently issued' });

  const returnDate = today();
  let fine = 0;
  if (returnDate > txn.due_date) {
    const daysLate = Math.round((new Date(returnDate) - new Date(txn.due_date)) / 86400000);
    fine = daysLate * FINE_PER_DAY;
  }

  dbLib.run(`UPDATE transactions SET status='returned', return_date=?, fine=? WHERE id=?`, [returnDate, fine, txn.id]);
  dbLib.run(`UPDATE books SET available_copies = available_copies + 1 WHERE id=?`, [txn.book_id]);

  // Notify the next student in the reservation queue, if any
  const nextRes = dbLib.get(
    `SELECT * FROM reservations WHERE book_id=? AND status='waiting' ORDER BY id ASC LIMIT 1`,
    [txn.book_id]
  );
  if (nextRes) {
    dbLib.run(`UPDATE reservations SET status='fulfilled' WHERE id=?`, [nextRes.id]);
    const book = dbLib.get('SELECT * FROM books WHERE id = ?', [txn.book_id]);
    dbLib.run(`INSERT INTO notifications (student_id, message, created_at) VALUES (?,?,?)`, [
      nextRes.student_id,
      `"${book.title}" is now available for you to borrow (your reservation).`,
      today(),
    ]);
  }

  res.json({ message: 'Return recorded', fine });
});

// ---------- Librarian: catalog management (FR10) ----------
app.get('/api/librarian/catalog', requireAuth, requireLibrarian, (req, res) => {
  res.json(dbLib.all('SELECT * FROM books ORDER BY title'));
});

app.post('/api/librarian/catalog', requireAuth, requireLibrarian, (req, res) => {
  const { title, author, isbn, copies } = req.body || {};
  const numCopies = Number(copies);
  if (!title || !author || !isbn || !Number.isInteger(numCopies) || numCopies < 1) {
    return res.status(400).json({ error: 'All fields are required with valid copy count' });
  }
  const id = dbLib.insert(
    `INSERT INTO books (title, author, isbn, total_copies, available_copies) VALUES (?,?,?,?,?)`,
    [String(title).trim(), String(author).trim(), String(isbn).trim(), numCopies, numCopies]
  );
  res.json({ id });
});

// ---------- Librarian: authorized student IDs ----------
app.get('/api/librarian/authorized-ids', requireAuth, requireLibrarian, (req, res) => {
  const rows = dbLib.all(
    `SELECT a.id, a.student_id, a.notes, a.status, a.created_at, a.used_at,
            u.name AS used_by_name, u.email AS used_by_email, u.membership_status AS user_status
     FROM authorized_student_ids a
     LEFT JOIN users u ON u.id = a.used_by
     ORDER BY a.id DESC`
  );
  res.json(rows);
});

app.post('/api/librarian/authorized-ids', requireAuth, requireLibrarian, (req, res) => {
  const { studentId, notes } = req.body || {};
  const cleanId = typeof studentId === 'string' ? studentId.trim().toUpperCase() : '';
  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 120) : '';

  if (!/^[A-Z0-9._/-]{2,40}$/.test(cleanId)) {
    return res.status(400).json({
      error: 'Student ID must be 2–40 characters (letters, numbers, -, _, ., /)'
    });
  }

  const existingAuth = dbLib.get(
    'SELECT id FROM authorized_student_ids WHERE upper(student_id) = ?',
    [cleanId]
  );
  if (existingAuth) {
    return res.status(409).json({ error: 'This Student ID is already in the authorized list' });
  }

  const existingUser = dbLib.get(
    'SELECT id FROM users WHERE upper(student_id) = ?',
    [cleanId]
  );
  if (existingUser) {
    return res.status(409).json({ error: 'This Student ID is already assigned to an existing account' });
  }

  const id = dbLib.insert(
    `INSERT INTO authorized_student_ids (student_id, notes, status, created_by, created_at)
     VALUES (?, ?, 'unused', ?, ?)`,
    [cleanId, cleanNotes || null, req.user.id, today()]
  );

  const created = dbLib.get(
    `SELECT id, student_id, notes, status, created_at FROM authorized_student_ids WHERE id = ?`,
    [id]
  );
  res.status(201).json(created);
});

app.delete('/api/librarian/authorized-ids/:id', requireAuth, requireLibrarian, (req, res) => {
  const record = dbLib.get('SELECT * FROM authorized_student_ids WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ error: 'Authorized Student ID not found' });
  if (record.status !== 'unused') {
    return res.status(409).json({ error: 'Cannot remove a Student ID that has already been used' });
  }
  dbLib.run('DELETE FROM authorized_student_ids WHERE id = ?', [record.id]);
  res.json({ message: 'Authorized Student ID removed' });
});

// ---------- Librarian: student registration verification ----------
app.get('/api/librarian/registrations', requireAuth, requireLibrarian, (req, res) => {
  const rows = dbLib.all(
    `SELECT id, name, email, role, membership_status, student_id, created_at
     FROM users
     WHERE role = 'student' AND student_id IS NOT NULL
     ORDER BY CASE membership_status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, id DESC`
  );
  res.json(rows);
});

app.post('/api/librarian/registrations/:id/approve', requireAuth, requireLibrarian, (req, res) => {
  const student = dbLib.get(
    `SELECT id, name, email, role, membership_status, student_id
     FROM users WHERE id = ? AND role = 'student' AND student_id IS NOT NULL`,
    [req.params.id]
  );
  if (!student) {
    return res.status(404).json({ error: 'Student registration request not found' });
  }
  if (student.membership_status !== 'pending') {
    return res.status(400).json({ error: `Registration is already ${student.membership_status}` });
  }

  dbLib.transaction(() => {
    dbLib.run(`UPDATE users SET membership_status = 'active' WHERE id = ?`, [student.id]);
    dbLib.run(
      `INSERT INTO notifications (student_id, message, created_at) VALUES (?, ?, ?)`,
      [student.id, 'Welcome to LMS! Your student registration has been approved.', today()]
    );
  });

  res.json({ message: `Approved registration for ${student.name}`, status: 'active' });
});

app.post('/api/librarian/registrations/:id/reject', requireAuth, requireLibrarian, (req, res) => {
  const student = dbLib.get(
    `SELECT id, name, email, role, membership_status, student_id
     FROM users WHERE id = ? AND role = 'student' AND student_id IS NOT NULL`,
    [req.params.id]
  );
  if (!student) {
    return res.status(404).json({ error: 'Student registration request not found' });
  }
  if (student.membership_status !== 'pending') {
    return res.status(400).json({ error: `Registration is already ${student.membership_status}` });
  }

  dbLib.run(`UPDATE users SET membership_status = 'rejected' WHERE id = ?`, [student.id]);
  res.json({ message: `Rejected registration for ${student.name}`, status: 'rejected' });
});

const PORT = process.env.PORT || 3000;
dbLib.init().then(() => {
  app.listen(PORT, () => console.log(`Library Management System running on http://localhost:${PORT}`));
});
