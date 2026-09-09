const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'store.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      maxStock INTEGER DEFAULT 0,
      barcode TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      unit TEXT DEFAULT 'piece',
      imageUrl TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      expiryDate TEXT DEFAULT '',
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT '',
      lastPriceReviewDate TEXT DEFAULT '',
      lastCostUpdateDate TEXT DEFAULT '',
      priceReviewStatus TEXT DEFAULT '',
      marginPercent REAL DEFAULT 0,
      priceReviewPriority TEXT DEFAULT '',
      totalUnitsSold INTEGER DEFAULT 0,
      lastSoldDate TEXT DEFAULT '',
      priceLocked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      creditLimit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      totalPurchases INTEGER DEFAULT 0,
      lastPurchaseDate TEXT DEFAULT '',
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
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'cash',
      paymentStatus TEXT DEFAULT 'paid',
      profit REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'paid'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      date TEXT DEFAULT '',
      customerId TEXT DEFAULT '',
      amount REAL DEFAULT 0,
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
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      frequency TEXT DEFAULT 'daily',
      priority TEXT DEFAULT 'medium',
      lastCompletedDate TEXT DEFAULT '',
      nextDueDate TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      active INTEGER DEFAULT 1,
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
      lastSaleDate TEXT DEFAULT '',
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

module.exports = { getDb };
