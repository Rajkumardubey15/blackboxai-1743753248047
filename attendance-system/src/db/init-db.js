const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Create tables
const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('in', 'out')) NOT NULL,
      location TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_employee_id ON attendances(employee_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON attendances(timestamp);
  `);

  // Create admin user if not exists
  const adminExists = db.prepare('SELECT 1 FROM employees WHERE employee_id = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO employees (employee_id, name, password, email)
      VALUES (?, ?, ?, ?)
    `).run('admin', 'Admin User', hashedPassword, 'admin@company.com');
  }

  console.log('Database initialized successfully');
};

module.exports = initDatabase;