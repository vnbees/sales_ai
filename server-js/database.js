const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'products.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    features TEXT NOT NULL,
    target_audience TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Product operations
const createProduct = db.prepare(`
  INSERT INTO products (id, name, price, features, target_audience)
  VALUES (?, ?, ?, ?, ?)
`);

const getProduct = db.prepare(`
  SELECT * FROM products WHERE id = ?
`);

// Conversation operations
const saveConversation = db.prepare(`
  INSERT INTO conversations (product_id, role, message)
  VALUES (?, ?, ?)
`);

const getConversations = db.prepare(`
  SELECT role, message FROM conversations
  WHERE product_id = ?
  ORDER BY created_at ASC
`);

module.exports = {
  createProduct,
  getProduct,
  saveConversation,
  getConversations
};
