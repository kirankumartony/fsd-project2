import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

let database

export async function getDb() {
  if (database) {
    return database
  }

  database = await open({
    filename: './server/finance.db',
    driver: sqlite3.Database,
  })

  await database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Income','Expense')),
      amount REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      spent REAL NOT NULL,
      limit_amount REAL NOT NULL,
      note TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, category)
    );

    CREATE TABLE IF NOT EXISTS pots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      saved REAL NOT NULL,
      goal REAL NOT NULL,
      cadence TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      due TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  return database
}

export async function seedUserData(userId) {
  const db = await getDb()

  const existingTransaction = await db.get(
    'SELECT id FROM transactions WHERE user_id = ? LIMIT 1',
    userId,
  )

  if (existingTransaction) {
    return
  }

  await db.run(
    `INSERT INTO transactions (user_id, date, merchant, category, type, amount)
     VALUES
     (?, 'Apr 19', 'Payroll deposit', 'Income', 'Income', 4800),
     (?, 'Apr 18', 'Whole Foods', 'Groceries', 'Expense', -126),
     (?, 'Apr 18', 'Rent', 'Housing', 'Expense', -1450),
     (?, 'Apr 17', 'Spotify', 'Subscriptions', 'Expense', -15),
     (?, 'Apr 16', 'City Transit', 'Transport', 'Expense', -42),
     (?, 'Apr 13', 'Consulting invoice', 'Income', 'Income', 1200)
    `,
    userId,
    userId,
    userId,
    userId,
    userId,
    userId,
  )

  await db.run(
    `INSERT INTO budgets (user_id, category, spent, limit_amount, note)
     VALUES
     (?, 'Groceries', 612, 750, 'Latest 3: Whole Foods, Trader Joe, Market Basket'),
     (?, 'Dining out', 338, 400, 'Latest 3: Cafe Luna, Sushi House, Tacos 4U'),
     (?, 'Transport', 121, 180, 'Latest 3: City Transit, Gas station, Parking'),
     (?, 'Entertainment', 74, 150, 'Latest 3: Movie tickets, Concert stream, Arcade')
    `,
    userId,
    userId,
    userId,
    userId,
  )

  await db.run(
    `INSERT INTO pots (user_id, name, saved, goal, cadence)
     VALUES
     (?, 'Emergency fund', 8200, 12000, 'Monthly auto-transfer'),
     (?, 'Vacation', 2650, 4000, 'Bi-weekly top-up'),
     (?, 'New laptop', 1380, 2000, 'Manual deposits')
    `,
    userId,
    userId,
    userId,
  )

  await db.run(
    `INSERT INTO bills (user_id, name, due, status, amount)
     VALUES
     (?, 'Internet', 'Apr 22', 'Upcoming', 79),
     (?, 'Electricity', 'Apr 24', 'Scheduled', 112),
     (?, 'Insurance', 'Apr 28', 'Paid', 184)
    `,
    userId,
    userId,
    userId,
  )
}
