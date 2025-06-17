const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (db) => {
  // Initialize staff_status table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS staff_status (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'on_leave', 'terminated', 'suspended')),
        extra TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating staff_status table:', err.message);
    });
  });

  // Get all staff status
  router.get('/', (req, res) => {
    db.all(`
      SELECT id, name, department, status, extra, 
             strftime('%Y-%m-%d %H:%M', created_at) as created_at,
             strftime('%Y-%m-%d %H:%M', updated_at) as updated_at
      FROM staff_status
      ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch staff status records'
        });
      }
      res.json({ 
        success: true,
        count: rows.length,
        data: rows
      });
    });
  });

  // Add a staff status
  router.post('/', (req, res) => {
    const { name, department, status = 'active', extra = '' } = req.body;
    
    // Validate input
    if (!name || !department) {
      return res.status(400).json({ 
        success: false,
        error: 'Name and department are required' 
      });
    }

    // Validate status
    const validStatuses = ['active', 'on_leave', 'terminated', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO staff_status (id, name, department, status, extra) VALUES (?, ?, ?, ?, ?)',
      [id, name, department, status, extra],
      function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to add staff status record'
          });
        }
        
        // Get the newly created record
        db.get('SELECT * FROM staff_status WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ 
              success: false,
              error: 'Failed to retrieve newly created record'
            });
          }
          
          res.status(201).json({ 
            success: true,
            message: 'Staff status record added successfully',
            data: row
          });
        });
      }
    );
  });

  // Update a staff status
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, department, status, extra } = req.body;
    
    // Validate input
    if (!name || !department || !status) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, department, and status are required for updates'
      });
    }

    // Validate status
    const validStatuses = ['active', 'on_leave', 'terminated', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    db.run(
      `UPDATE staff_status 
       SET name = ?, department = ?, status = ?, extra = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, department, status, extra, id],
      function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to update staff status record'
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'Staff status record not found'
          });
        }
        
        // Get the updated record
        db.get('SELECT * FROM staff_status WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ 
              success: false,
              error: 'Failed to retrieve updated record'
            });
          }
          
          res.json({ 
            success: true,
            message: 'Staff status record updated successfully',
            data: row
          });
        });
      }
    );
  });

  // Delete a staff status
  router.delete('/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM staff_status WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to verify staff status record'
        });
      }
      
      if (!row) {
        return res.status(404).json({ 
          success: false,
          error: 'Staff status record not found'
        });
      }
      
      db.run('DELETE FROM staff_status WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to delete staff status record'
          });
        }
        
        res.json({ 
          success: true,
          message: 'Staff status record deleted successfully',
          deletedRecord: row
        });
      });
    });
  });

  return router;
};