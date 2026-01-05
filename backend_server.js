const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const PORT = 8005;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration de la base de données MySQL
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'saas_management',
  namedPlaceholders: true
};

// Fonction pour exécuter des requêtes SQL
async function query(sql, params = []) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

// Routes CRUD pour les tenants

// GET - Récupérer tous les tenants avec leurs modules
app.get('/api/tenants', async (req, res) => {
  try {
    // Récupérer les tenants
    const tenants = await query(`
      SELECT id, name, email, phone, subscription_status, created_at, updated_at 
      FROM tenants 
      ORDER BY created_at DESC
    `);

    // Pour chaque tenant, récupérer ses modules
    for (let tenant of tenants) {
      const modules = await query(`
        SELECT m.id, m.code, m.name, m.icon, m.enabled,
               tm.tenant_id, tm.module_id, tm.is_active
        FROM modules m
        JOIN tenant_modules tm ON m.id = tm.module_id
        WHERE tm.tenant_id = ?
      `, [tenant.id]);

      tenant.modules = modules.map(module => ({
        id: module.id,
        code: module.code,
        name: module.name,
        icon: module.icon,
        enabled: module.enabled,
        pivot: {
          tenant_id: module.tenant_id,
          module_id: module.module_id,
          is_active: module.is_active
        }
      }));

      tenant.users = [];
      tenant.subscriptions = [];
    }

    res.json({
      success: true,
      data: tenants,
      message: 'Tenants retrieved successfully from MySQL database'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

// POST - Créer un nouveau tenant
app.post('/api/tenants', async (req, res) => {
  try {
    const { name, email, phone, subscription_status } = req.body;

    // Validation
    if (!name || !email || !subscription_status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, subscription_status'
      });
    }

    // Vérifier si l'email existe déjà
    const existing = await query('SELECT id FROM tenants WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Insérer le tenant
    const result = await query(`
      INSERT INTO tenants (name, email, phone, subscription_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [name, email, phone || null, subscription_status]);

    // Récupérer le tenant créé
    const newTenant = await query('SELECT * FROM tenants WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: newTenant[0],
      message: 'Tenant created successfully in MySQL database'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

// PUT - Mettre à jour un tenant
app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, subscription_status } = req.body;

    // Validation
    if (!name || !email || !subscription_status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, subscription_status'
      });
    }

    // Vérifier si le tenant existe
    const existing = await query('SELECT id FROM tenants WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Vérifier si l'email est utilisé par un autre tenant
    const emailCheck = await query('SELECT id FROM tenants WHERE email = ? AND id != ?', [email, id]);
    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Mettre à jour le tenant
    await query(`
      UPDATE tenants 
      SET name = ?, email = ?, phone = ?, subscription_status = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, email, phone || null, subscription_status, id]);

    // Récupérer le tenant mis à jour
    const updatedTenant = await query('SELECT * FROM tenants WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedTenant[0],
      message: 'Tenant updated successfully in MySQL database'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

// DELETE - Supprimer un tenant
app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si le tenant existe
    const existing = await query('SELECT id FROM tenants WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Supprimer d'abord les relations avec les modules
    await query('DELETE FROM tenant_modules WHERE tenant_id = ?', [id]);

    // Supprimer le tenant
    await query('DELETE FROM tenants WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Tenant deleted successfully from MySQL database'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Connected to MySQL database: saas_management`);
  console.log(`🔗 API endpoints available:`);
  console.log(`   GET    /api/tenants`);
  console.log(`   POST   /api/tenants`);
  console.log(`   PUT    /api/tenants/:id`);
  console.log(`   DELETE /api/tenants/:id`);
});

module.exports = app;
