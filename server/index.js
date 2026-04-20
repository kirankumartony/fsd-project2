import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDb, seedUserData } from './db.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT ?? 4000)
const JWT_SECRET = process.env.JWT_SECRET ?? 'development-secret-change-me'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(__dirname, '../dist')

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing token.' })
    return
  }

  try {
    const token = authHeader.slice(7)
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body ?? {}

  if (!name || !email || !password || String(password).length < 6) {
    res.status(400).json({ message: 'Name, email, and password (min 6 chars) are required.' })
    return
  }

  const db = await getDb()
  const existingUser = await db.get('SELECT id FROM users WHERE email = ?', String(email).toLowerCase())

  if (existingUser) {
    res.status(409).json({ message: 'Email already registered.' })
    return
  }

  const passwordHash = await bcrypt.hash(String(password), 10)
  const result = await db.run(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    String(name).trim(),
    String(email).toLowerCase(),
    passwordHash,
  )

  const user = { id: result.lastID, name: String(name).trim(), email: String(email).toLowerCase() }
  await seedUserData(user.id)

  res.status(201).json({
    token: createToken(user),
    user,
  })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' })
    return
  }

  const db = await getDb()
  const user = await db.get('SELECT id, name, email, password_hash FROM users WHERE email = ?', String(email).toLowerCase())

  if (!user) {
    res.status(401).json({ message: 'Invalid credentials.' })
    return
  }

  const passwordOk = await bcrypt.compare(String(password), user.password_hash)
  if (!passwordOk) {
    res.status(401).json({ message: 'Invalid credentials.' })
    return
  }

  await seedUserData(user.id)

  res.json({
    token: createToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  })
})

app.get('/api/auth/me', authenticate, async (req, res) => {
  const db = await getDb()
  const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', req.user.id)
  if (!user) {
    res.status(404).json({ message: 'User not found.' })
    return
  }

  res.json({ user })
})

app.get('/api/dashboard', authenticate, async (req, res) => {
  const db = await getDb()
  const userId = req.user.id

  const transactions = await db.all(
    'SELECT id, date, merchant, category, type, amount FROM transactions WHERE user_id = ? ORDER BY id DESC',
    userId,
  )
  const budgets = await db.all(
    'SELECT category, spent, limit_amount as "limit", note FROM budgets WHERE user_id = ? ORDER BY category ASC',
    userId,
  )
  const pots = await db.all(
    'SELECT name, saved, goal, cadence FROM pots WHERE user_id = ? ORDER BY name ASC',
    userId,
  )
  const bills = await db.all(
    'SELECT id, name, due, status, amount FROM bills WHERE user_id = ? ORDER BY id ASC',
    userId,
  )

  res.json({ transactions, budgets, pots, bills })
})

app.post('/api/transactions', authenticate, async (req, res) => {
  const { date, merchant, category, type = 'Expense', amount } = req.body ?? {}

  if (!date || !merchant || !category || typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    res.status(400).json({ message: 'Invalid transaction payload.' })
    return
  }

  const userId = req.user.id
  const normalizedType = type === 'Income' ? 'Income' : 'Expense'
  const normalizedAmount = normalizedType === 'Expense' ? -Math.abs(amount) : Math.abs(amount)

  const db = await getDb()
  await db.run(
    'INSERT INTO transactions (user_id, date, merchant, category, type, amount) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    date,
    merchant,
    category,
    normalizedType,
    normalizedAmount,
  )

  if (normalizedType === 'Expense') {
    await db.run(
      'UPDATE budgets SET spent = spent + ? WHERE user_id = ? AND lower(category) = lower(?)',
      Math.abs(normalizedAmount),
      userId,
      category,
    )
  }

  const transactions = await db.all(
    'SELECT id, date, merchant, category, type, amount FROM transactions WHERE user_id = ? ORDER BY id DESC',
    userId,
  )
  const budgets = await db.all(
    'SELECT category, spent, limit_amount as "limit", note FROM budgets WHERE user_id = ? ORDER BY category ASC',
    userId,
  )

  res.status(201).json({ transactions, budgets })
})

app.delete('/api/transactions/:id', authenticate, async (req, res) => {
  const transactionId = Number(req.params.id)
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    res.status(400).json({ message: 'Invalid transaction id.' })
    return
  }

  const db = await getDb()
  const userId = req.user.id
  const transaction = await db.get(
    'SELECT id, category, type, amount FROM transactions WHERE id = ? AND user_id = ?',
    transactionId,
    userId,
  )

  if (!transaction) {
    res.status(404).json({ message: 'Transaction not found.' })
    return
  }

  await db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', transactionId, userId)

  if (transaction.type === 'Expense') {
    await db.run(
      'UPDATE budgets SET spent = MAX(0, spent - ?) WHERE user_id = ? AND lower(category) = lower(?)',
      Math.abs(transaction.amount),
      userId,
      transaction.category,
    )
  }

  const transactions = await db.all(
    'SELECT id, date, merchant, category, type, amount FROM transactions WHERE user_id = ? ORDER BY id DESC',
    userId,
  )
  const budgets = await db.all(
    'SELECT category, spent, limit_amount as "limit", note FROM budgets WHERE user_id = ? ORDER BY category ASC',
    userId,
  )

  res.json({ transactions, budgets })
})

app.post('/api/pots/:name/move', authenticate, async (req, res) => {
  const { name } = req.params
  const { direction } = req.body ?? {}

  if (direction !== 1 && direction !== -1) {
    res.status(400).json({ message: 'Direction must be 1 or -1.' })
    return
  }

  const db = await getDb()
  const userId = req.user.id
  const pot = await db.get(
    'SELECT id, name, saved, goal, cadence FROM pots WHERE user_id = ? AND lower(name) = lower(?)',
    userId,
    name,
  )

  if (!pot) {
    res.status(404).json({ message: 'Pot not found.' })
    return
  }

  const step = Math.round(pot.goal * 0.05)
  const nextSaved = Math.max(0, Math.min(pot.goal, pot.saved + direction * step))

  await db.run('UPDATE pots SET saved = ? WHERE id = ?', nextSaved, pot.id)

  const pots = await db.all('SELECT name, saved, goal, cadence FROM pots WHERE user_id = ? ORDER BY name ASC', userId)

  res.json({ pots })
})

app.delete('/api/pots/:name', authenticate, async (req, res) => {
  const { name } = req.params
  const db = await getDb()
  const userId = req.user.id

  await db.run(
    'DELETE FROM pots WHERE user_id = ? AND lower(name) = lower(?)',
    userId,
    String(name),
  )

  const pots = await db.all('SELECT name, saved, goal, cadence FROM pots WHERE user_id = ? ORDER BY name ASC', userId)
  res.json({ pots })
})

app.delete('/api/budgets/:category', authenticate, async (req, res) => {
  const { category } = req.params
  const db = await getDb()
  const userId = req.user.id

  await db.run(
    'DELETE FROM budgets WHERE user_id = ? AND lower(category) = lower(?)',
    userId,
    String(category),
  )

  const budgets = await db.all(
    'SELECT category, spent, limit_amount as "limit", note FROM budgets WHERE user_id = ? ORDER BY category ASC',
    userId,
  )
  res.json({ budgets })
})

app.post('/api/bills', authenticate, async (req, res) => {
  const { name, due, status = 'Upcoming', amount } = req.body ?? {}

  const allowedStatus = new Set(['Paid', 'Upcoming', 'Scheduled'])
  if (
    !name ||
    !due ||
    !allowedStatus.has(status) ||
    typeof amount !== 'number' ||
    Number.isNaN(amount) ||
    amount <= 0
  ) {
    res.status(400).json({ message: 'Invalid bill payload.' })
    return
  }

  const db = await getDb()
  const userId = req.user.id

  await db.run(
    'INSERT INTO bills (user_id, name, due, status, amount) VALUES (?, ?, ?, ?, ?)',
    userId,
    String(name).trim(),
    String(due).trim(),
    status,
    Math.abs(amount),
  )

  const bills = await db.all(
    'SELECT id, name, due, status, amount FROM bills WHERE user_id = ? ORDER BY id ASC',
    userId,
  )

  res.status(201).json({ bills })
})

app.delete('/api/bills/:id', authenticate, async (req, res) => {
  const billId = Number(req.params.id)
  if (!Number.isInteger(billId) || billId <= 0) {
    res.status(400).json({ message: 'Invalid bill id.' })
    return
  }

  const db = await getDb()
  const userId = req.user.id

  await db.run('DELETE FROM bills WHERE id = ? AND user_id = ?', billId, userId)

  const bills = await db.all(
    'SELECT id, name, due, status, amount FROM bills WHERE user_id = ? ORDER BY id ASC',
    userId,
  )

  res.json({ bills })
})

app.delete('/api/bills/paid', authenticate, async (req, res) => {
  const db = await getDb()
  const userId = req.user.id

  await db.run('DELETE FROM bills WHERE user_id = ? AND lower(status) = lower(?)', userId, 'Paid')

  const bills = await db.all(
    'SELECT id, name, due, status, amount FROM bills WHERE user_id = ? ORDER BY id ASC',
    userId,
  )

  res.json({ bills })
})

if (existsSync(distPath)) {
  app.use(express.static(distPath))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next()
      return
    }

    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, async () => {
  await getDb()
  console.log(`API server running on http://localhost:${PORT}`)
})
