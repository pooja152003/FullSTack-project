const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs

module.exports = (db) => {
  // Initialize staff table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dept TEXT NOT NULL,
        role TEXT NOT NULL,
        date TEXT NOT NULL CHECK(date LIKE '____-__-__') -- Simple date format validation
      )
    `, (err) => {
      if (err) console.error('Error creating staff table:', err.message);
    });
  });

  // Get all staff
  router.get('/', (req, res) => {
    db.all('SELECT * FROM staff', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ 
          message: 'Database error', 
          error: err.message 
        });
      }
      res.json(rows);
    });
  });

  // Add a staff member
  router.post('/', (req, res) => {
    const { name, dept, role, date } = req.body;
    
    // Input validation
    if (!name || !dept || !role || !date) {
      return res.status(400).json({ 
        message: 'Name, department, role, and date are required' 
      });
    }
    
    // Simple date format check (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        message: 'Date must be in YYYY-MM-DD format' 
      });
    }

    const id = uuidv4(); // Better than Date.now()
    db.run(
      'INSERT INTO staff (id, name, dept, role, date) VALUES (?, ?, ?, ?, ?)',
      [id, name, dept, role, date],
      function(err) {
        if (err) {
          return res.status(500).json({ 
            message: 'Database error', 
            error: err.message 
          });
        }
        res.status(201).json({ 
          message: 'Staff added',
          data: { id, name, dept, role, date }
        });
      }
    );
  });

  // Delete a staff member
  router.delete('/:id', (req, res) => {
    db.get('SELECT id FROM staff WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ 
          message: 'Database error', 
          error: err.message 
        });
      }
      if (!row) {
        return res.status(404).json({ 
          message: 'Staff not found' 
        });
      }
      db.run('DELETE FROM staff WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          return res.status(500).json({ 
            message: 'Database error', 
            error: err.message 
          });
        }
        res.json({ 
          message: 'Staff deleted',
          id: req.params.id
        });
      });
    });
  });

  return router;
};