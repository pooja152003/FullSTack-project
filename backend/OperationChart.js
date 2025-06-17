const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (db) => {
  // Initialize operation_chart table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS operation_chart (
        id TEXT PRIMARY KEY,
        patient TEXT NOT NULL,
        procedure TEXT NOT NULL,
        doctor TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating operation_chart table:', err.message);
    });
  });

  // Get all operations
  router.get('/', (req, res) => {
    db.all('SELECT * FROM operation_chart', [], (err, rows) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch operations' 
        });
      }
      res.json({ 
        success: true,
        data: rows 
      });
    });
  });

  // Add an operation
  router.post('/', (req, res) => {
    const { patient, procedure, doctor, date, status = 'scheduled' } = req.body;
    
    // Validate input
    if (!patient || !procedure || !doctor || !date) {
      return res.status(400).json({ 
        success: false,
        error: 'Patient, procedure, doctor, and date are required' 
      });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        success: false,
        error: 'Date must be in YYYY-MM-DD format' 
      });
    }

    const id = uuidv4(); // Better than Date.now()
    db.run(
      'INSERT INTO operation_chart (id, patient, procedure, doctor, date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, patient, procedure, doctor, date, status],
      function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to add operation' 
          });
        }
        res.status(201).json({ 
          success: true,
          message: 'Operation added successfully',
          data: { id, patient, procedure, doctor, date, status }
        });
      }
    );
  });

  // Delete an operation
  router.delete('/:id', (req, res) => {
    db.get('SELECT id FROM operation_chart WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to verify operation' 
        });
      }
      if (!row) {
        return res.status(404).json({ 
          success: false,
          error: 'Operation not found' 
        });
      }
      
      db.run('DELETE FROM operation_chart WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to delete operation' 
          });
        }
        res.json({ 
          success: true,
          message: 'Operation deleted successfully',
          deletedId: req.params.id
        });
      });
    });
  });

  return router;
};