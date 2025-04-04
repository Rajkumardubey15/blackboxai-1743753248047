const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const winston = require('winston');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new Database(dbPath);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Login endpoint
router.post('/login', (req, res) => {
    const { employee_id, password } = req.body;
    
    try {
        const employee = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id);
        
        if (!employee) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = bcrypt.compareSync(password, employee.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: employee.id, employee_id: employee.employee_id },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ 
            token,
            employee: {
                id: employee.id,
                employee_id: employee.employee_id,
                name: employee.name,
                email: employee.email
            }
        });
    } catch (err) {
        winston.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Punch in/out endpoint
router.post('/punch', authenticateToken, (req, res) => {
    const { status } = req.body;
    const employee_id = req.user.employee_id;
    
    try {
        // Get employee's last punch
        const lastPunch = db.prepare(`
            SELECT status FROM attendances 
            WHERE employee_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `).get(employee_id);

        // Validate punch sequence
        if (lastPunch && lastPunch.status === status) {
            return res.status(400).json({ 
                error: `You've already punched ${status === 'in' ? 'in' : 'out'}`
            });
        }

        // Get client IP for location
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        // Record new punch
        db.prepare(`
            INSERT INTO attendances (employee_id, status, location)
            VALUES (?, ?, ?)
        `).run(employee_id, status, ip);

        res.json({ 
            message: `Successfully punched ${status === 'in' ? 'in' : 'out'}`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        winston.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Attendance history endpoint
router.get('/history', authenticateToken, (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const employee_id = req.user.employee_id;
    
    try {
        const history = db.prepare(`
            SELECT timestamp, status, location 
            FROM attendances 
            WHERE employee_id = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `).all(employee_id, limit, offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count 
            FROM attendances 
            WHERE employee_id = ?
        `).get(employee_id).count;

        res.json({
            history,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        winston.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Admin middleware to check if user is admin
function isAdmin(req, res, next) {
  if (req.user.employee_id === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

// Get all employees (admin only)
router.get('/admin/employees', authenticateToken, isAdmin, (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT id, employee_id, name, email 
      FROM employees 
      WHERE employee_id != 'admin'
    `).all();
    res.json(employees);
  } catch (err) {
    winston.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new employee (admin only)
router.post('/admin/employee', authenticateToken, isAdmin, (req, res) => {
  const { employee_id, name, password, email } = req.body;
  
  try {
    // Validate required fields
    if (!employee_id || !name || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert new employee
    const stmt = db.prepare(`
      INSERT INTO employees (employee_id, name, password, email)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(employee_id, name, hashedPassword, email);
    
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Employee ID or email already exists' });
    }
    winston.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
