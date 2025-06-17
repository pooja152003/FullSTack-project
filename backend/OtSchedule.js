const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (db) => {
  // Initialize ot_schedule table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS ot_schedule (
        id TEXT PRIMARY KEY,
        room TEXT NOT NULL,
        time TEXT NOT NULL,
        procedure TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(procedure) REFERENCES procedures(id)
      )
    `, (err) => {
      if (err) console.error('Error creating ot_schedule table:', err.message);
    });
  });

  // Get all OT schedules
  router.get('/', (req, res) => {
    db.all(`
      SELECT os.*, p.name as procedure_name 
      FROM ot_schedule os
      LEFT JOIN procedures p ON os.procedure = p.id
    `, [], (err, rows) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch OT schedules' 
        });
      }
      res.json({ 
        success: true,
        data: rows 
      });
    });
  });

  // Add an OT schedule
  router.post('/', (req, res) => {
    const { room, time, procedure, status = 'scheduled' } = req.body;
    
    // Validate input
    if (!room || !time || !procedure) {
      return res.status(400).json({ 
        success: false,
        error: 'Room, time, and procedure are required' 
      });
    }

    // Validate time format (HH:MM)
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ 
        success: false,
        error: 'Time must be in HH:MM format (24-hour)' 
      });
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO ot_schedule (id, room, time, procedure, status) VALUES (?, ?, ?, ?, ?)',
      [id, room, time, procedure, status],
      function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to add OT schedule' 
          });
        }
        res.status(201).json({ 
          success: true,
          message: 'OT schedule added successfully',
          data: { id, room, time, procedure, status }
        });
      }
    );
  });

  // Update an OT schedule
  router.put('/:id', (req, res) => {
    const { room, time, procedure, status } = req.body;
    const { id } = req.params;

    // Validate input
    if (!room || !time || !procedure || !status) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required for update' 
      });
    }

    db.run(
      `UPDATE ot_schedule 
       SET room = ?, time = ?, procedure = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [room, time, procedure, status, id],
      function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to update OT schedule' 
          });
        }
        if (this.changes === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'OT schedule not found' 
          });
        }
        res.json({ 
          success: true,
          message: 'OT schedule updated successfully',
          data: { id, room, time, procedure, status }
        });
      }
    );
  });

  // Delete an OT schedule
  router.delete('/:id', (req, res) => {
    db.get('SELECT id FROM ot_schedule WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to verify OT schedule' 
        });
      }
      if (!row) {
        return res.status(404).json({ 
          success: false,
          error: 'OT schedule not found' 
        });
      }
      
      db.run('DELETE FROM ot_schedule WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to delete OT schedule' 
          });
        }
        res.json({ 
          success: true,
          message: 'OT schedule deleted successfully',
          deletedId: req.params.id
        });
      });
    });
  });

  return router;
};