const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;
let initPromise = null;

function getDb() {
  if (db) return db;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const dir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const dbPath = path.join(dir, 'store.db');
      db = new Database(dbPath);
      
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -8000');
      db.pragma('foreign_keys = ON');
      
      initTables();
      addIndexes();
      
      return db;
    } catch (err) {
      console.error('Database initialization failed:', err);
      db = null;
      initPromise = null;
      throw err;
    }
  })();
  
  return initPromise;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      price REAL DEFAULT 0 CHECK(price >= 0),
      cost REAL DEFAULT 0 CHECK(cost >= 0),
      stock INTEGER DEFAULT 0 CHECK(stock >= 0),
      minStock INTEGER DEFAULT 0 CHECK(minStock >= 0),
      maxStock INTEGER DEFAULT 0,
      barcode TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      unit TEXT DEFAULT 'piece',
      imageUrl TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      expiryDate TEXT DEFAULT NULL,
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT '',
      lastPriceReviewDate TEXT DEFAULT NULL,
      lastCostUpdateDate TEXT DEFAULT NULL,
      priceReviewStatus TEXT DEFAULT '',
      marginPercent REAL DEFAULT 0,
      priceReviewPriority TEXT DEFAULT '',
      totalUnitsSold INTEGER DEFAULT 0,
      lastSoldDate TEXT DEFAULT NULL,
      priceLocked INTEGER DEFAULT 0 CHECK(priceLocked IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      creditLimit REAL DEFAULT 0 CHECK(creditLimit >= 0),
      balance REAL DEFAULT 0,
      active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      totalPurchases INTEGER DEFAULT 0,
      lastPurchaseDate TEXT DEFAULT NULL,
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date TEXT DEFAULT '',
      customerId TEXT DEFAULT '',
      customerName TEXT DEFAULT '',
      items TEXT DEFAULT '[]',
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0 CHECK(discount >= 0),
      total REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'cash' CHECK(paymentMethod IN ('cash', 'udhaar', 'card', 'bank', 'other')),
      paymentStatus TEXT DEFAULT 'paid' CHECK(paymentStatus IN ('paid', 'unpaid', 'partial')),
      profit REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'paid' CHECK(status IN ('paid', 'unpaid', 'refunded', 'partial'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      date TEXT DEFAULT '',
      customerId TEXT DEFAULT '',
      amount REAL DEFAULT 0 CHECK(amount > 0),
      method TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      invoiceId TEXT DEFAULT '',
      paymentType TEXT DEFAULT '',
      balanceAfter REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wholesalers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Supplier',
      contactPerson TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      frequency TEXT DEFAULT 'daily' CHECK(frequency IN ('daily', 'every3days', 'weekly', 'monthly', 'onetime')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      lastCompletedDate TEXT DEFAULT NULL,
      nextDueDate TEXT DEFAULT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped')),
      active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS auditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT '',
      action TEXT DEFAULT '',
      operator TEXT DEFAULT '',
      details TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS productPriceHistory (
      id TEXT PRIMARY KEY,
      productId TEXT DEFAULT '',
      oldCost REAL DEFAULT 0,
      newCost REAL DEFAULT 0,
      oldPrice REAL DEFAULT 0,
      newPrice REAL DEFAULT 0,
      changeReason TEXT DEFAULT '',
      updatedBy TEXT DEFAULT '',
      timestamp TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS productAnalytics (
      productId TEXT PRIMARY KEY,
      unitsSold30Days INTEGER DEFAULT 0,
      unitsSold90Days INTEGER DEFAULT 0,
      lastSaleDate TEXT DEFAULT NULL,
      averageMonthlySales REAL DEFAULT 0,
      marginPercent REAL DEFAULT 0,
      reviewScore REAL DEFAULT 0,
      lastCalculated TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );
  `);
}

function addIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sales_customerId ON sales(customerId);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_payments_customerId ON payments(customerId);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);
    CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock, minStock);
    CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiryDate);
    CREATE INDEX IF NOT EXISTS idx_productPriceHistory_productId ON productPriceHistory(productId);
    CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(balance);
    CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);
    CREATE INDEX IF NOT EXISTS idx_auditLogs_timestamp ON auditLogs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_todos_active ON todos(active);
    CREATE INDEX IF NOT EXISTS idx_wholesalers_active ON wholesalers(active);
  `);
}

process.on('exit', () => { if (db) db.close(); });
process.on('SIGINT', () => { if (db) db.close(); process.exit(0); });
process.on('SIGTERM', () => { if (db) db.close(); process.exit(0); });

module.exports = { getDb };
