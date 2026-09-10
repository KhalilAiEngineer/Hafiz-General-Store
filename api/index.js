const { getDb } = require('./db');

const ALLOWED_TABLES = ['products', 'customers', 'wholesalers', 'todos', 'auditLogs', 'productPriceHistory', 'productAnalytics'];
const ALLOWED_COLUMNS = {
  products: ['id','name','category','price','cost','stock','minStock','maxStock','barcode','sku','unit','imageUrl','supplier','expiryDate','createdAt','updatedAt','lastPriceReviewDate','lastCostUpdateDate','priceReviewStatus','marginPercent','priceReviewPriority','totalUnitsSold','lastSoldDate','priceLocked'],
  customers: ['id','name','phone','creditLimit','balance','active','address','city','totalPurchases','lastPurchaseDate','createdAt','updatedAt'],
  sales: ['id','date','customerId','customerName','items','subtotal','discount','total','paymentMethod','paymentStatus','profit','tax','paidAmount','remainingAmount','status'],
  payments: ['id','date','customerId','amount','method','notes','invoiceId','paymentType','balanceAfter'],
  wholesalers: ['id','name','type','contactPerson','phone','address','active','createdAt','updatedAt'],
  todos: ['id','title','frequency','priority','lastCompletedDate','nextDueDate','status','active','createdAt','updatedAt'],
  auditLogs: ['id','timestamp','action','operator','details'],
  productPriceHistory: ['id','productId','oldCost','newCost','oldPrice','newPrice','changeReason','updatedBy','timestamp'],
  productAnalytics: ['productId','unitsSold30Days','unitsSold90Days','lastSaleDate','averageMonthlySales','marginPercent','reviewScore','lastCalculated']
};

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[%_]/g, m => '\\' + m).trim();
}

function parseSaleItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function generateId(prefix, tableName, db) {
  try {
    const row = db.prepare(`SELECT id FROM ${tableName} WHERE id LIKE ? ORDER BY CAST(SUBSTR(id, ${prefix.length + 1}) AS INTEGER) DESC LIMIT 1`).get(`${prefix}%`);
    if (!row) return `${prefix}1001`;
    const numPart = row.id.replace(prefix, '');
    const num = parseInt(numPart, 10);
    if (isNaN(num)) return `${prefix}1001`;
    return `${prefix}${num + 1}`;
  } catch {
    return `${prefix}${Date.now()}`;
  }
}

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });

  (async () => {
    try {
      const db = await getDb();
      if (!db) return res.status(500).json({ status: 'error', message: 'Database not initialized' });

      if (req.method === 'GET') {
        const action = req.query.action;
        if (action === 'getAllData') {
          return res.status(200).json({ status: 'success', data: getAllData(db) });
        }
        return res.status(400).json({ status: 'error', message: 'Unknown GET action' });
      }

      if (req.method === 'POST') {
        const body = req.body;
        const action = body.action;
        const data = body.data || body;
        const operator = (typeof body.operator === 'string' && body.operator.trim()) ? body.operator.trim() : 'Admin';

        switch (action) {
          case 'syncAllData': return handleSyncAllData(db, data, res);
          case 'recordSalesBatch': return handleRecordSalesBatch(db, data, res);
          case 'recordPaymentsBatch': return handleRecordPaymentsBatch(db, data, res);
          case 'saveProduct': return handleSaveProduct(db, data, operator, res);
          case 'deleteProduct': return handleDeleteProduct(db, data, res);
          case 'saveCustomer': return handleSaveCustomer(db, data, operator, res);
          case 'deleteCustomer': return handleDeleteCustomer(db, data, res);
          case 'saveWholesaler': return handleSaveWholesaler(db, data, operator, res);
          case 'deleteWholesaler': return handleDeleteWholesaler(db, data, res);
          case 'saveTodo': return handleSaveTodo(db, data, operator, res);
          case 'deleteTodo': return handleDeleteTodo(db, data, res);
          case 'refundSale': return handleRefundSale(db, data, operator, res);
          case 'logAuditAction': return handleLogAudit(db, data, res);
          case 'databaseOverview': return handleDatabaseOverview(db, res);
          case 'dataQualityAnalyzer': return handleDataQuality(db, res);
          case 'relationshipInspector': return handleRelationshipInspector(db, res);
          case 'fixBrokenReferences': return handleFixBrokenRefs(db, res);
          case 'generateSKU': return handleGenerateSKU(db, data, res);
          case 'recalculateInventory': return handleRecalculateInventory(db, res);
          case 'recordSale': return handleRecordSale(db, data, operator, res);
          case 'recordPayment': return handleRecordPayment(db, data, operator, res);
          case 'dashboardStats': return handleDashboardStats(db, res);
          case 'pricingIntelligenceDashboard': return handlePricingIntelligence(db, res);
          case 'productExpiryMonitor': return handleExpiryMonitor(db, res);
          case 'creditRecoveryIntelligence': return handleCreditRecovery(db, res);
          case 'updateProductPrice': return handleUpdateProductPrice(db, data, operator, res);
          case 'lockProductPrice': return handleLockProductPrice(db, data, res);
          case 'acceptPricingSuggestion': return handleAcceptPricing(db, data, operator, res);
          case 'bulkPriceAction': return handleBulkPriceAction(db, data, operator, res);
          case 'savePricingMarginRules': return handleSaveMarginRules(db, data, res);
          case 'sheetExplorer': return handleSheetExplorer(db, res);
          case 'smartSchemaInspector': return handleSchemaInspector(db, res);
          default:
            return res.status(400).json({ status: 'error', message: `Unknown action: ${action}` });
        }
      }

      return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    } catch (err) {
      console.error('API Error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  })();
}

function getAllData(db) {
  return {
    products: db.prepare('SELECT * FROM products').all(),
    customers: db.prepare('SELECT * FROM customers').all(),
    sales: db.prepare('SELECT * FROM sales').all(),
    payments: db.prepare('SELECT * FROM payments').all(),
    wholesalers: db.prepare('SELECT * FROM wholesalers').all(),
    todos: db.prepare('SELECT * FROM todos').all(),
    auditLogs: db.prepare('SELECT * FROM auditLogs ORDER BY id DESC LIMIT 200').all(),
    productPriceHistories: db.prepare('SELECT * FROM productPriceHistory').all(),
    productAnalytics: db.prepare('SELECT * FROM productAnalytics').all()
  };
}

function handleSyncAllData(db, data, res) {
  try {
    const transaction = db.transaction(() => {
      for (const tableName of ALLOWED_TABLES) {
        const tableData = data[tableName];
        if (!tableData || !Array.isArray(tableData)) continue;

        const dbTable = tableName === 'productPriceHistories' ? 'productPriceHistory' : tableName;
        const allowedCols = ALLOWED_COLUMNS[tableName] || ALLOWED_COLUMNS[dbTable];
        if (!allowedCols) continue;

        db.prepare(`DELETE FROM ${dbTable}`).run();

        if (tableData.length === 0) continue;

        const validCols = Object.keys(tableData[0]).filter(c => allowedCols.includes(c));
        if (validCols.length === 0) continue;

        const placeholders = validCols.map(() => '?').join(',');
        const stmt = db.prepare(`INSERT INTO ${dbTable} (${validCols.join(',')}) VALUES (${placeholders})`);

        for (const row of tableData) {
          stmt.run(...validCols.map(c => row[c] !== undefined ? row[c] : null));
        }
      }
    });
    transaction();
    return res.status(200).json({ status: 'success', message: 'All data synced' });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ status: 'error', message: 'Sync failed' });
  }
}

function handleRecordSalesBatch(db, sales, res) {
  if (!Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No sales provided' });
  }

  try {
    const transaction = db.transaction(() => {
      const inserted = [];
      const stockUpdates = {};
      const balanceUpdates = {};

      for (const sale of sales) {
        if (!sale.id) continue;
        const existing = db.prepare('SELECT id FROM sales WHERE id = ?').get(sale.id);
        if (existing) continue;

        const items = parseSaleItems(sale.items);
        if (items.length === 0) continue;

        let totalCost = 0;
        let stockValid = true;

        for (const item of items) {
          const product = db.prepare('SELECT cost, stock FROM products WHERE id = ?').get(item.id);
          if (!product) { stockValid = false; break; }
          if (product.stock < item.qty) { stockValid = false; break; }
          totalCost += product.cost * item.qty;
        }

        if (!stockValid) continue;

        const profit = (sale.total || 0) - totalCost;
        const paidAmount = sale.paymentMethod === 'udhaar' ? 0 : (sale.total || 0);
        const remainingAmount = sale.paymentMethod === 'udhaar' ? (sale.total || 0) : 0;
        const status = sale.paymentMethod === 'udhaar' ? 'unpaid' : 'paid';

        db.prepare(`INSERT INTO sales (id, date, customerId, customerName, items, subtotal, discount, total, paymentMethod, paymentStatus, profit, tax, paidAmount, remainingAmount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          sale.id, sale.date || new Date().toISOString(), sale.customerId || '', sale.customerName || '',
          JSON.stringify(items), sale.subtotal || 0, sale.discount || 0, sale.total || 0,
          sale.paymentMethod || 'cash', status, profit, sale.tax || 0, paidAmount, remainingAmount, status
        );
        inserted.push(sale.id);

        for (const item of items) {
          if (!stockUpdates[item.id]) stockUpdates[item.id] = 0;
          stockUpdates[item.id] -= item.qty;
        }

        if (sale.paymentMethod === 'udhaar' && sale.customerId) {
          if (!balanceUpdates[sale.customerId]) balanceUpdates[sale.customerId] = 0;
          balanceUpdates[sale.customerId] += (sale.total || 0);
        }
      }

      for (const [pid, qty] of Object.entries(stockUpdates)) {
        db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?').run(qty, pid);
      }
      for (const [cid, amt] of Object.entries(balanceUpdates)) {
        db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(amt, cid);
      }

      return inserted;
    });

    const ids = transaction();
    return res.status(200).json({ status: 'success', ids });
  } catch (err) {
    console.error('Record sales batch error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to record sales' });
  }
}

function handleRecordPaymentsBatch(db, payments, res) {
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No payments provided' });
  }

  try {
    const transaction = db.transaction(() => {
      const inserted = [];
      const balanceUpdates = {};

      for (const p of payments) {
        if (!p.id || !p.customerId || !p.amount || p.amount <= 0) continue;
        const existing = db.prepare('SELECT id FROM payments WHERE id = ?').get(p.id);
        if (existing) continue;

        const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(p.customerId);
        if (!customer) continue;
        if (p.amount > customer.balance) continue;

        const newBalance = customer.balance - p.amount;
        db.prepare(`INSERT INTO payments (id, date, customerId, amount, method, notes, invoiceId, paymentType, balanceAfter)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          p.id, p.date || new Date().toISOString(), p.customerId, p.amount,
          p.method || '', p.notes || '', p.invoiceId || '', p.paymentType || '', newBalance
        );
        inserted.push(p.id);

        if (!balanceUpdates[p.customerId]) balanceUpdates[p.customerId] = 0;
        balanceUpdates[p.customerId] -= p.amount;
      }

      for (const [cid, amt] of Object.entries(balanceUpdates)) {
        db.prepare('UPDATE customers SET balance = MAX(0, balance + ?) WHERE id = ?').run(amt, cid);
      }

      return inserted;
    });

    const ids = transaction();
    return res.status(200).json({ status: 'success', ids });
  } catch (err) {
    console.error('Record payments batch error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to record payments' });
  }
}

function handleSaveProduct(db, data, operator, res) {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  const now = new Date().toISOString();
  const name = data.name.trim();
  const category = (data.category || '').trim();
  const price = Math.max(0, Number(data.price) || 0);
  const cost = Math.max(0, Number(data.cost) || 0);
  const stock = Math.max(0, Math.floor(Number(data.stock) || 0));
  const minStock = Math.max(0, Math.floor(Number(data.minStock) || 0));
  const maxStock = Math.max(0, Math.floor(Number(data.maxStock) || 0));
  const barcode = (data.barcode || '').trim();
  const sku = (data.sku || '').trim();
  const unit = (data.unit || 'piece').trim();
  const imageUrl = (data.imageUrl || '').trim();
  const supplier = (data.supplier || '').trim();
  const expiryDate = data.expiryDate || null;
  const priceLocked = data.priceLocked ? 1 : 0;

  try {
    const transaction = db.transaction(() => {
      if (data.id) {
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(data.id);
        if (!existing) return { error: 'Product not found' };

        if (cost !== existing.cost || price !== existing.price) {
          const histId = generateId('PH', 'productPriceHistory', db);
          db.prepare(`INSERT INTO productPriceHistory (id, productId, oldCost, newCost, oldPrice, newPrice, changeReason, updatedBy, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            histId, data.id, existing.cost, cost, existing.price, price,
            'Updated', operator, now
          );
        }

        db.prepare(`UPDATE products SET name=?, category=?, price=?, cost=?, stock=?, minStock=?, maxStock=?, barcode=?, sku=?, unit=?, imageUrl=?, supplier=?, expiryDate=?, updatedAt=?, priceLocked=? WHERE id=?`).run(
          name, category, price, cost, stock, minStock, maxStock, barcode, sku, unit, imageUrl, supplier, expiryDate, now, priceLocked, data.id
        );
        return { id: data.id };
      }

      const id = generateId('P', 'products', db);
      db.prepare(`INSERT INTO products (id, name, category, price, cost, stock, minStock, maxStock, barcode, sku, unit, imageUrl, supplier, expiryDate, createdAt, updatedAt, priceLocked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, name, category, price, cost, stock, minStock, maxStock, barcode, sku, unit, imageUrl, supplier, expiryDate, now, now, priceLocked
      );
      return { id };
    });

    const result = transaction();
    if (result.error) return res.status(400).json({ status: 'error', message: result.error });
    return res.status(200).json({ status: 'success', id: result.id });
  } catch (err) {
    console.error('Save product error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to save product' });
  }
}

function handleDeleteProduct(db, data, res) {
  if (!data.id) return res.status(400).json({ status: 'error', message: 'ID required' });

  try {
    const sales = db.prepare("SELECT id FROM sales WHERE items LIKE ?").get(`%"id":"${data.id}"%`);
    if (sales) return res.status(400).json({ status: 'error', message: 'Cannot delete - referenced in sales' });
    db.prepare('DELETE FROM products WHERE id = ?').run(data.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to delete product' });
  }
}

function handleSaveCustomer(db, data, operator, res) {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  const now = new Date().toISOString();
  const name = data.name.trim();
  const phone = (data.phone || '').trim();
  const creditLimit = Math.max(0, Number(data.creditLimit) || 0);
  const balance = Number(data.balance) || 0;
  const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;
  const address = (data.address || '').trim();
  const city = (data.city || '').trim();

  try {
    if (data.id) {
      const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(data.id);
      if (!existing) return res.status(404).json({ status: 'error', message: 'Customer not found' });

      db.prepare(`UPDATE customers SET name=?, phone=?, creditLimit=?, balance=?, active=?, address=?, city=?, updatedAt=? WHERE id=?`).run(
        name, phone, creditLimit, balance, active, address, city, now, data.id
      );
      return res.status(200).json({ status: 'success', id: data.id });
    }

    const id = generateId('C', 'customers', db);
    db.prepare(`INSERT INTO customers (id, name, phone, creditLimit, balance, active, address, city, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, name, phone, creditLimit, balance, active, address, city, now, now
    );
    return res.status(200).json({ status: 'success', id });
  } catch (err) {
    console.error('Save customer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to save customer' });
  }
}

function handleDeleteCustomer(db, data, res) {
  if (!data.id) return res.status(400).json({ status: 'error', message: 'ID required' });
  try {
    const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(data.id);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Not found' });
    if (customer.balance > 0) return res.status(400).json({ status: 'error', message: 'Cannot delete - outstanding balance' });
    db.prepare('UPDATE customers SET active = 0 WHERE id = ?').run(data.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Delete customer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to delete customer' });
  }
}

function handleSaveWholesaler(db, data, operator, res) {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  const now = new Date().toISOString();
  const name = data.name.trim();
  const type = (data.type || 'Supplier').trim();
  const contactPerson = (data.contactPerson || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();
  const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;

  try {
    if (data.id) {
      const existing = db.prepare('SELECT id FROM wholesalers WHERE id = ?').get(data.id);
      if (!existing) return res.status(404).json({ status: 'error', message: 'Wholesaler not found' });

      db.prepare(`UPDATE wholesalers SET name=?, type=?, contactPerson=?, phone=?, address=?, active=?, updatedAt=? WHERE id=?`).run(
        name, type, contactPerson, phone, address, active, now, data.id
      );
      return res.status(200).json({ status: 'success', id: data.id });
    }

    const id = generateId('W', 'wholesalers', db);
    db.prepare(`INSERT INTO wholesalers (id, name, type, contactPerson, phone, address, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, name, type, contactPerson, phone, address, active, now, now
    );
    return res.status(200).json({ status: 'success', id });
  } catch (err) {
    console.error('Save wholesaler error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to save wholesaler' });
  }
}

function handleDeleteWholesaler(db, data, res) {
  if (!data.id) return res.status(400).json({ status: 'error', message: 'ID required' });
  try {
    db.prepare('UPDATE wholesalers SET active = 0 WHERE id = ?').run(data.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Delete wholesaler error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to delete wholesaler' });
  }
}

function handleSaveTodo(db, data, operator, res) {
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return res.status(400).json({ status: 'error', message: 'Title required' });
  }

  const validFrequencies = ['daily', 'every3days', 'weekly', 'monthly', 'onetime'];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const frequency = validFrequencies.includes(data.frequency) ? data.frequency : 'daily';
  const priority = validPriorities.includes(data.priority) ? data.priority : 'medium';

  const now = new Date().toISOString();
  const title = data.title.trim();
  const lastCompletedDate = data.lastCompletedDate || null;
  const nextDueDate = data.nextDueDate || null;
  const status = data.status || 'pending';
  const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;

  try {
    if (data.id) {
      const existing = db.prepare('SELECT id FROM todos WHERE id = ?').get(data.id);
      if (!existing) return res.status(404).json({ status: 'error', message: 'Todo not found' });

      db.prepare(`UPDATE todos SET title=?, frequency=?, priority=?, lastCompletedDate=?, nextDueDate=?, status=?, active=?, updatedAt=? WHERE id=?`).run(
        title, frequency, priority, lastCompletedDate, nextDueDate, status, active, now, data.id
      );
      return res.status(200).json({ status: 'success', id: data.id });
    }

    const id = `T${Date.now()}${Math.random().toString(36).substring(2, 5)}`;
    db.prepare(`INSERT INTO todos (id, title, frequency, priority, lastCompletedDate, nextDueDate, status, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, title, frequency, priority, lastCompletedDate, nextDueDate, 'pending', 1, now, now
    );
    return res.status(200).json({ status: 'success', id });
  } catch (err) {
    console.error('Save todo error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to save todo' });
  }
}

function handleDeleteTodo(db, data, res) {
  if (!data.id) return res.status(400).json({ status: 'error', message: 'ID required' });
  try {
    db.prepare('UPDATE todos SET active = 0 WHERE id = ?').run(data.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Delete todo error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to delete todo' });
  }
}

function handleRecordSale(db, data, operator, res) {
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No items' });
  }
  if (!data.id) {
    return res.status(400).json({ status: 'error', message: 'Sale ID required' });
  }

  try {
    const transaction = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM sales WHERE id = ?').get(data.id);
      if (existing) return { id: data.id, alreadyExists: true };

      const items = parseSaleItems(data.items);
      let totalCost = 0;

      for (const item of items) {
        const product = db.prepare('SELECT cost, stock FROM products WHERE id = ?').get(item.id);
        if (!product) throw new Error(`Product ${item.id} not found`);
        if (product.stock < item.qty) throw new Error(`Insufficient stock for ${item.name || item.id}`);
        totalCost += product.cost * item.qty;
      }

      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.qty, item.id);
      }

      const profit = (data.total || 0) - totalCost;
      const paidAmount = data.paymentMethod === 'udhaar' ? 0 : (data.total || 0);
      const remainingAmount = data.paymentMethod === 'udhaar' ? (data.total || 0) : 0;
      const status = data.paymentMethod === 'udhaar' ? 'unpaid' : 'paid';

      db.prepare(`INSERT INTO sales (id, date, customerId, customerName, items, subtotal, discount, total, paymentMethod, paymentStatus, profit, tax, paidAmount, remainingAmount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        data.id, data.date || new Date().toISOString(), data.customerId || '', data.customerName || '',
        JSON.stringify(items), data.subtotal || 0, data.discount || 0, data.total || 0,
        data.paymentMethod || 'cash', status, profit, data.tax || 0, paidAmount, remainingAmount, status
      );

      if (data.paymentMethod === 'udhaar' && data.customerId) {
        db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(data.total || 0, data.customerId);
      }

      return { id: data.id, total: data.total, paymentMethod: data.paymentMethod };
    });

    const result = transaction();
    return res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('Record sale error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to record sale' });
  }
}

function handleRecordPayment(db, data, operator, res) {
  if (!data.customerId) return res.status(400).json({ status: 'error', message: 'Customer required' });
  if (!data.amount || Number(data.amount) <= 0) return res.status(400).json({ status: 'error', message: 'Valid amount required' });

  try {
    const transaction = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM payments WHERE id = ?').get(data.id);
      if (existing) return { id: data.id, alreadyExists: true };

      const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(data.customerId);
      if (!customer) throw new Error('Customer not found');
      if (Number(data.amount) > customer.balance) throw new Error('Amount exceeds balance');

      const newBalance = customer.balance - Number(data.amount);
      const paymentId = data.id || `PAY${Date.now()}${Math.random().toString(36).substring(2, 5)}`;

      db.prepare(`INSERT INTO payments (id, date, customerId, amount, method, notes, invoiceId, paymentType, balanceAfter)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        paymentId, data.date || new Date().toISOString(), data.customerId,
        Number(data.amount), data.method || '', data.notes || '', data.invoiceId || '', data.paymentType || '', newBalance
      );
      db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, data.customerId);

      return { id: paymentId, updatedBalance: newBalance };
    });

    const result = transaction();
    return res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('Record payment error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to record payment' });
  }
}

function handleRefundSale(db, data, operator, res) {
  if (!data.id) return res.status(400).json({ status: 'error', message: 'Sale ID required' });

  try {
    const transaction = db.transaction(() => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(data.id);
      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'refunded') throw new Error('Already refunded');

      db.prepare('UPDATE sales SET status = ?, paymentStatus = ? WHERE id = ?').run('refunded', 'refunded', data.id);

      const items = parseSaleItems(sale.items);
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.id);
      }

      if (sale.paymentMethod === 'udhaar' && sale.customerId) {
        db.prepare('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?').run(sale.total, sale.customerId);
      }
    });

    transaction();
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Refund sale error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to refund sale' });
  }
}

function handleLogAudit(db, data, res) {
  try {
    db.prepare('INSERT INTO auditLogs (timestamp, action, operator, details) VALUES (?, ?, ?, ?)').run(
      data.timestamp || new Date().toISOString(), data.action || '', data.operator || 'Admin', data.details || ''
    );
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Log audit error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to log audit' });
  }
}

function handleDashboardStats(db, res) {
  try {
    const totalSales = db.prepare("SELECT COALESCE(SUM(total), 0) as val FROM sales WHERE status != 'refunded'").get().val;
    const totalProfit = db.prepare("SELECT COALESCE(SUM(profit), 0) as val FROM sales WHERE status != 'refunded'").get().val;
    const totalDebt = db.prepare('SELECT COALESCE(SUM(balance), 0) as val FROM customers WHERE active = 1 AND balance > 0').get().val;
    const lowStockCount = db.prepare('SELECT COUNT(*) as val FROM products WHERE stock <= minStock AND stock > 0').get().val;
    const expiringSoonCount = db.prepare("SELECT COUNT(*) as val FROM products WHERE expiryDate IS NOT NULL AND expiryDate != '' AND date(expiryDate) <= date('now', '+30 days') AND date(expiryDate) >= date('now')").get().val;
    const topDebtors = db.prepare('SELECT name, balance FROM customers WHERE balance > 0 AND active = 1 ORDER BY balance DESC LIMIT 5').all();

    let topProducts = [];
    try {
      topProducts = db.prepare(`SELECT p.name, SUM(CAST(json_extract(s.value, '$.qty') AS INTEGER)) as qty FROM sales, json_each(sales.items) s, products p WHERE json_extract(s.value, '$.id') = p.id AND sales.status != 'refunded' GROUP BY json_extract(s.value, '$.id') ORDER BY qty DESC LIMIT 5`).all();
    } catch { topProducts = []; }

    const dailyRows = db.prepare("SELECT date, SUM(total) as sales, SUM(profit) as profit FROM sales WHERE status != 'refunded' GROUP BY date(date) ORDER BY date DESC LIMIT 30").all();
    const dailyTrend = {};
    dailyRows.forEach(r => { dailyTrend[r.date] = { sales: r.sales, profit: r.profit }; });

    return res.status(200).json({
      status: 'success',
      stats: { totalSales, totalProfit, totalDebt, lowStockCount, expiringSoonCount, topDebtors, topProducts, dailyTrend }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
}

function handleDatabaseOverview(db, res) {
  try {
    const counts = {
      products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
      customers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
      sales: db.prepare('SELECT COUNT(*) as c FROM sales').get().c,
      payments: db.prepare('SELECT COUNT(*) as c FROM payments').get().c,
      wholesalers: db.prepare('SELECT COUNT(*) as c FROM wholesalers WHERE active = 1').get().c,
      todos: db.prepare('SELECT COUNT(*) as c FROM todos WHERE active = 1').get().c,
    };
    return res.status(200).json({
      status: 'success',
      data: { systemHealth: { status: 'Healthy' }, recordStatistics: counts, instantAlerts: [] }
    });
  } catch (err) {
    console.error('Database overview error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to get overview' });
  }
}

function handleDataQuality(db, res) {
  try {
    const issues = { products: [], customers: [], sales: [], payments: [] };

    db.prepare('SELECT id, name FROM products WHERE sku = "" OR sku IS NULL').all()
      .forEach(p => issues.products.push({ id: p.id, name: p.name, issue: 'Missing SKU', severity: 'warning' }));

    db.prepare('SELECT id, name FROM products WHERE stock < 0').all()
      .forEach(p => issues.products.push({ id: p.id, name: p.name, issue: 'Negative stock', severity: 'critical' }));

    db.prepare('SELECT id, name FROM customers WHERE phone = "" OR phone IS NULL').all()
      .forEach(c => issues.customers.push({ id: c.id, name: c.name, issue: 'Missing phone', severity: 'warning' }));

    return res.status(200).json({ status: 'success', data: issues });
  } catch (err) {
    console.error('Data quality error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to analyze quality' });
  }
}

function handleRelationshipInspector(db, res) {
  try {
    const broken = [];
    const sales = db.prepare("SELECT id, customerId FROM sales WHERE customerId != '' AND customerId IS NOT NULL").all();
    for (const s of sales) {
      const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(s.customerId);
      if (!cust) broken.push({ type: 'Sale-Customer', recordId: s.id, missingReference: s.customerId, severity: 'high' });
    }
    return res.status(200).json({ status: 'success', data: broken });
  } catch (err) {
    console.error('Relationship inspector error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to inspect relationships' });
  }
}

function handleFixBrokenRefs(db, res) {
  try {
    const fixes = [];
    db.prepare("SELECT id, customerName FROM sales WHERE (customerId = '' OR customerId IS NULL) AND (customerName = '' OR customerName IS NULL)").all()
      .forEach(s => {
        db.prepare("UPDATE sales SET customerName = 'Unknown Customer' WHERE id = ?").run(s.id);
        fixes.push({ type: 'Fixed sale customer name', id: s.id });
      });
    return res.status(200).json({ status: 'success', fixes });
  } catch (err) {
    console.error('Fix broken refs error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fix references' });
  }
}

function handleGenerateSKU(db, data, res) {
  if (!data.productId) return res.status(400).json({ status: 'error', message: 'Product ID required' });
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(data.productId);
    if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });
    const sku = `${(product.category || 'GEN').substring(0, 3).toUpperCase()}-${(product.name || 'Item').substring(0, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    db.prepare('UPDATE products SET sku = ? WHERE id = ?').run(sku, data.productId);
    return res.status(200).json({ status: 'success', newSKU: sku });
  } catch (err) {
    console.error('Generate SKU error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to generate SKU' });
  }
}

function handleRecalculateInventory(db, res) {
  try {
    const products = db.prepare('SELECT id FROM products').all();
    let count = 0;
    for (const p of products) {
      const sold = db.prepare(`SELECT COALESCE(SUM(CAST(json_extract(s.value, '$.qty') AS INTEGER)), 0) as total FROM sales, json_each(sales.items) s WHERE json_extract(s.value, '$.id') = ? AND sales.status != 'refunded'`).get(p.id);
      if (sold && sold.total > 0) {
        db.prepare('UPDATE products SET totalUnitsSold = ? WHERE id = ?').run(sold.total, p.id);
        count++;
      }
    }
    return res.status(200).json({ status: 'success', message: `Inventory recalculated for ${count} products` });
  } catch (err) {
    console.error('Recalculate inventory error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to recalculate' });
  }
}

function handlePricingIntelligence(db, res) {
  try {
    const products = db.prepare('SELECT * FROM products').all();
    const dashboard = { totalProducts: products.length, avgMargin: 0, lossMaking: 0, lowMargin: 0 };
    let totalMargin = 0;
    products.forEach(p => {
      const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
      totalMargin += margin;
      if (p.price < p.cost) dashboard.lossMaking++;
      if (margin < 15 && p.price >= p.cost) dashboard.lowMargin++;
    });
    dashboard.avgMargin = products.length > 0 ? totalMargin / products.length : 0;
    return res.status(200).json({ status: 'success', data: { dashboard, reviewQueue: [], alerts: [], opportunities: [] } });
  } catch (err) {
    console.error('Pricing intelligence error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to get pricing data' });
  }
}

function handleExpiryMonitor(db, res) {
  try {
    const products = db.prepare("SELECT * FROM products WHERE expiryDate IS NOT NULL AND expiryDate != ''").all();
    const now = new Date();
    const expired = [], critical = [], warning = [], safe = [];
    products.forEach(p => {
      const exp = new Date(p.expiryDate);
      const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      const item = { ...p, daysUntilExpiry: days };
      if (days < 0) expired.push(item);
      else if (days <= 7) critical.push(item);
      else if (days <= 14) warning.push(item);
      else safe.push(item);
    });
    return res.status(200).json({ status: 'success', data: { expired, critical, warning, safe, financialLoss: 0 } });
  } catch (err) {
    console.error('Expiry monitor error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to check expiry' });
  }
}

function handleCreditRecovery(db, res) {
  try {
    const customers = db.prepare('SELECT * FROM customers WHERE balance > 0 AND active = 1').all();
    const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
    return res.status(200).json({
      status: 'success',
      data: {
        summary: { totalCustomers: customers.length, totalOutstanding, highRiskCustomers: 0 },
        customers: customers.map(c => ({ ...c, riskLevel: c.balance > (c.creditLimit * 0.8) ? 'High' : 'Low' })),
        agingAggregate: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
      }
    });
  } catch (err) {
    console.error('Credit recovery error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to analyze credit' });
  }
}

function handleUpdateProductPrice(db, data, operator, res) {
  if (!data.productId) return res.status(400).json({ status: 'error', message: 'Product ID required' });
  if (!data.newPrice || Number(data.newPrice) <= 0) return res.status(400).json({ status: 'error', message: 'Valid price required' });

  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(data.productId);
    if (!product) return res.status(404).json({ status: 'error', message: 'Not found' });

    const now = new Date().toISOString();
    const newPrice = Number(data.newPrice);

    const transaction = db.transaction(() => {
      const histId = generateId('PH', 'productPriceHistory', db);
      db.prepare(`INSERT INTO productPriceHistory (id, productId, oldCost, newCost, oldPrice, newPrice, changeReason, updatedBy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, data.productId, product.cost, product.cost, product.price, newPrice, data.reason || 'Price update', operator, now);
      db.prepare('UPDATE products SET price = ?, lastPriceReviewDate = ?, updatedAt = ? WHERE id = ?').run(newPrice, now, now, data.productId);
    });

    transaction();
    return res.status(200).json({ status: 'success', product: { ...product, price: newPrice } });
  } catch (err) {
    console.error('Update product price error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update price' });
  }
}

function handleLockProductPrice(db, data, res) {
  if (!data.productId) return res.status(400).json({ status: 'error', message: 'Product ID required' });
  try {
    db.prepare('UPDATE products SET priceLocked = ? WHERE id = ?').run(data.locked ? 1 : 0, data.productId);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Lock product price error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to lock price' });
  }
}

function handleAcceptPricing(db, data, operator, res) {
  if (!data.productId || !data.suggestedPrice) return res.status(400).json({ status: 'error', message: 'Product ID and price required' });
  return handleUpdateProductPrice(db, { productId: data.productId, newPrice: data.suggestedPrice, reason: data.reason }, operator, res);
}

function handleBulkPriceAction(db, data, operator, res) {
  if (!data.action) return res.status(400).json({ status: 'error', message: 'Action required' });

  try {
    let query = 'SELECT * FROM products WHERE priceLocked = 0';
    const params = [];
    if (data.filter) {
      if (data.filter.category) { query += ' AND category = ?'; params.push(data.filter.category); }
      if (data.filter.supplier) { query += ' AND supplier = ?'; params.push(data.filter.supplier); }
    }
    const products = db.prepare(query).all(...params);
    const updated = [];
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      for (const p of products) {
        let newPrice = p.price;
        if (data.action === 'increase') newPrice = p.price * (1 + (Number(data.percent) || 0) / 100);
        else if (data.action === 'decrease') newPrice = p.price * (1 - (Number(data.percent) || 0) / 100);
        else if (data.action === 'lock') { db.prepare('UPDATE products SET priceLocked = 1 WHERE id = ?').run(p.id); updated.push(p.id); continue; }
        else if (data.action === 'unlock') { db.prepare('UPDATE products SET priceLocked = 0 WHERE id = ?').run(p.id); updated.push(p.id); continue; }
        else continue;

        newPrice = Math.round(newPrice * 100) / 100;
        if (newPrice < 0) newPrice = 0;

        db.prepare('UPDATE products SET price = ?, updatedAt = ? WHERE id = ?').run(newPrice, now, p.id);
        const histId = generateId('PH', 'productPriceHistory', db);
        db.prepare(`INSERT INTO productPriceHistory (id, productId, oldCost, newCost, oldPrice, newPrice, changeReason, updatedBy, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, p.id, p.cost, p.cost, p.price, newPrice, data.reason || 'Bulk action', operator, now);
        updated.push(p.id);
      }
    });

    transaction();
    return res.status(200).json({ status: 'success', updatedCount: updated.length, updated });
  } catch (err) {
    console.error('Bulk price action error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to apply bulk action' });
  }
}

function handleSaveMarginRules(db, data, res) {
  if (!data.rules || typeof data.rules !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Rules object required' });
  }
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pricing_margin_rules', JSON.stringify(data.rules));
    return res.status(200).json({ status: 'success', data: data.rules });
  } catch (err) {
    console.error('Save margin rules error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to save rules' });
  }
}

function handleSheetExplorer(db, res) {
  try {
    const sheets = ['products', 'customers', 'sales', 'payments', 'wholesalers', 'todos', 'auditLogs'];
    const data = {};
    for (const s of sheets) {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${s}`).get().c;
      data[s] = { records: count, columns: 10, quality: 95 };
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err) {
    console.error('Sheet explorer error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to explore sheets' });
  }
}

function handleSchemaInspector(db, res) {
  return res.status(200).json({ status: 'success', data: { schema: {}, typeErrors: [] } });
}

module.exports = handleRequest;
