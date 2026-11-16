const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data', 'library.db');
let SQL, db;
let inTx = false;

function save() {
  if (!inTx) {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  }
}

function transaction(fn) {
  db.run('BEGIN');
  inTx = true;
  try {
    const result = fn();
    db.run('COMMIT');
    inTx = false;
    save();
    return result;
  } catch (err) {
    try { db.run('ROLLBACK'); } catch { }
    inTx = false;
    throw err;
  }
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// returns the last inserted row id
function insert(sql, params = []) {
  db.run(sql, params);
  const idRow = get('SELECT last_insert_rowid() AS id');
  save();
  return idRow.id;
}

// ── Schema migration: add columns and verification table if absent ─
// Uses PRAGMA table_info / sqlite_master to run idempotently.
// SQLite allows multiple NULLs in a UNIQUE column, so existing
// demo users (student_id = NULL) do not conflict with each other.
function migrate() {
  let changed = false;
  const cols = all('PRAGMA table_info(users)');
  const hasStudentId = cols.some(c => c.name === 'student_id');
  if (!hasStudentId) {
    db.run('ALTER TABLE users ADD COLUMN student_id TEXT');
    // Partial unique index: enforces uniqueness only for non-NULL values,
    // leaving existing demo accounts (student_id IS NULL) untouched.
    db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id
       ON users(student_id) WHERE student_id IS NOT NULL`
    );
    changed = true;
  }

  const hasCreatedAt = cols.some(c => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.run('ALTER TABLE users ADD COLUMN created_at TEXT');
    changed = true;
  }

  const authTable = get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='authorized_student_ids'`
  );
  if (!authTable) {
    db.run(`
      CREATE TABLE authorized_student_ids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT UNIQUE NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','revoked')),
        created_by INTEGER,
        created_at TEXT NOT NULL,
        used_by INTEGER,
        used_at TEXT,
        FOREIGN KEY(created_by) REFERENCES users(id),
        FOREIGN KEY(used_by) REFERENCES users(id)
      );
    `);
    changed = true;
  }

  if (changed) save();
}

async function init() {
  SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    migrate();  // safe no-op if schema is already up to date
    return;
  }

  db = new SQL.Database();

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','librarian')),
      membership_status TEXT NOT NULL DEFAULT 'active',
      student_id TEXT,
      created_at TEXT
    );
    CREATE UNIQUE INDEX idx_users_student_id
      ON users(student_id) WHERE student_id IS NOT NULL;

    CREATE TABLE authorized_student_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','revoked')),
      created_by INTEGER,
      created_at TEXT NOT NULL,
      used_by INTEGER,
      used_at TEXT,
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(used_by) REFERENCES users(id)
    );

    CREATE TABLE books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL,
      total_copies INTEGER NOT NULL,
      available_copies INTEGER NOT NULL
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','rejected','issued','returned')),
      request_date TEXT NOT NULL,
      issue_date TEXT,
      due_date TEXT,
      return_date TEXT,
      fine INTEGER DEFAULT 0,
      FOREIGN KEY(book_id) REFERENCES books(id),
      FOREIGN KEY(student_id) REFERENCES users(id)
    );

    CREATE TABLE reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      reserved_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','fulfilled','cancelled')),
      FOREIGN KEY(book_id) REFERENCES books(id),
      FOREIGN KEY(student_id) REFERENCES users(id)
    );

    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(student_id) REFERENCES users(id)
    );
  `);

  const studentPass = bcrypt.hashSync('student123', 8);
  const libPass = bcrypt.hashSync('lib123', 8);

  db.run(`INSERT INTO users (name,email,password,role,membership_status) VALUES
    ('Krishna','student@lms.edu','${studentPass}','student','active'),
    ('Karan Mehta','student2@lms.edu','${studentPass}','student','active'),
    ('Mrs. Sunitha','librarian@lms.edu','${libPass}','librarian','active')`);

  const books = [
    ['Clean Code', 'Robert C. Martin', '9780132350884', 3, 3],
    ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', '9780262033848', 2, 2],
    ['Database System Concepts', 'Silberschatz, Korth, Sudarshan', '9780078022159', 2, 1],
    ['Design Patterns', 'Gamma, Helm, Johnson, Vlissides', '9780201633610', 2, 0],
    ['Operating System Concepts', 'Silberschatz, Galvin, Gagne', '9781118063330', 3, 2],
    ['Software Engineering', 'Ian Sommerville', '9780133943030', 2, 2],
    ['Computer Networks', 'Andrew S. Tanenbaum', '9780132126953', 2, 1],
    ['The Pragmatic Programmer', 'Hunt & Thomas', '9780135957059', 2, 2],
  ];
  for (const b of books) {
    db.run('INSERT INTO books (title,author,isbn,total_copies,available_copies) VALUES (?,?,?,?,?)', b);
  }

  // Make one reservation exist already for the "Design Patterns" demo (0 available)
  db.run(`INSERT INTO reservations (book_id, student_id, reserved_date, status) VALUES (4, 2, date('now'), 'waiting')`);

  save();
}

module.exports = { init, run, all, get, insert, transaction };
