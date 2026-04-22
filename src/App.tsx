import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Transaction = {
  id: number
  date: string
  merchant: string
  category: string
  type: 'Income' | 'Expense'
  amount: number
}

type Budget = {
  category: string
  limit: number
  spent: number
  note: string
}

type Pot = {
  name: string
  saved: number
  goal: number
  cadence: string
}

type Bill = {
  id: number
  name: string
  due: string
  status: 'Paid' | 'Upcoming' | 'Scheduled'
  amount: number
}

type User = {
  id: number
  name: string
  email: string
}

type SalaryPlanRecord = {
  id: number
  monthKey: string
  salary: number
  spent: number
  remaining: number
  investmentStyle: InvestmentStyle
  emergency: number
  indexFund: number
  debtFund: number
  liquid: number
  createdAt: string
}

type InvestmentStyle = 'conservative' | 'balanced' | 'growth'

type UndoAction =
  | { kind: 'transaction'; transaction: Transaction; message: string }
  | { kind: 'bill'; bill: Bill; message: string }
  | { kind: 'paid-bills'; bills: Bill[]; message: string }

const initialTransactions: Transaction[] = [
  { id: 1, date: 'Apr 19', merchant: 'Payroll deposit', category: 'Income', type: 'Income', amount: 4800 },
  { id: 2, date: 'Apr 18', merchant: 'Whole Foods', category: 'Groceries', type: 'Expense', amount: -126 },
  { id: 3, date: 'Apr 18', merchant: 'Rent', category: 'Housing', type: 'Expense', amount: -1450 },
  { id: 4, date: 'Apr 17', merchant: 'Spotify', category: 'Subscriptions', type: 'Expense', amount: -15 },
  { id: 5, date: 'Apr 16', merchant: 'City Transit', category: 'Transport', type: 'Expense', amount: -42 },
  { id: 6, date: 'Apr 13', merchant: 'Consulting invoice', category: 'Income', type: 'Income', amount: 1200 },
]

const initialBudgets: Budget[] = [
  { category: 'Groceries', spent: 612, limit: 750, note: 'Latest 3: Whole Foods, Trader Joe, Market Basket' },
  { category: 'Dining out', spent: 338, limit: 400, note: 'Latest 3: Cafe Luna, Sushi House, Tacos 4U' },
  { category: 'Transport', spent: 121, limit: 180, note: 'Latest 3: City Transit, Gas station, Parking' },
  { category: 'Entertainment', spent: 74, limit: 150, note: 'Latest 3: Movie tickets, Concert stream, Arcade' },
]

const initialPots: Pot[] = [
  { name: 'Emergency fund', saved: 8200, goal: 12000, cadence: 'Monthly auto-transfer' },
  { name: 'Vacation', saved: 2650, goal: 4000, cadence: 'Bi-weekly top-up' },
  { name: 'New laptop', saved: 1380, goal: 2000, cadence: 'Manual deposits' },
]

const initialBills: Bill[] = [
  { id: 1, name: 'Internet', due: 'Apr 22', status: 'Upcoming', amount: 79 },
  { id: 2, name: 'Electricity', due: 'Apr 24', status: 'Scheduled', amount: 112 },
  { id: 3, name: 'Insurance', due: 'Apr 28', status: 'Paid', amount: 184 },
]

const rowsPerPage = 5

const investmentPresets: Record<
  InvestmentStyle,
  {
    label: string
    note: string
    split: {
      emergency: number
      indexFund: number
      debtFund: number
      liquid: number
    }
  }
> = {
  conservative: {
    label: 'Conservative',
    note: 'Higher safety with a stronger emergency and debt allocation.',
    split: { emergency: 40, indexFund: 25, debtFund: 25, liquid: 10 },
  },
  balanced: {
    label: 'Balanced',
    note: 'Mix of long-term growth and capital protection.',
    split: { emergency: 30, indexFund: 45, debtFund: 15, liquid: 10 },
  },
  growth: {
    label: 'Growth',
    note: 'Prioritizes long-term market investing for higher potential return.',
    split: { emergency: 20, indexFund: 60, debtFund: 10, liquid: 10 },
  },
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const monthIndexByLabel: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function formatMoney(amount: number) {
  return currency.format(amount)
}

function normalizeDateToIso(dateValue: string) {
  const value = String(dateValue ?? '').trim()
  if (!value) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`
  }

  const shortMonthMatch = /^([A-Za-z]{3})\s+(\d{1,2})$/.exec(value)
  if (shortMonthMatch) {
    const month = monthIndexByLabel[shortMonthMatch[1].toLowerCase()]
    const day = Number(shortMonthMatch[2])
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = new Date().getFullYear()
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function getMonthKeyFromDate(dateValue: string) {
  const normalized = normalizeDateToIso(dateValue)
  if (!normalized) {
    return ''
  }

  return normalized.slice(0, 7)
}

function formatMonthLabel(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey || 'selected month'
  }

  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function getStartOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function parseBillDueDate(due: string, referenceYear: number) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const [year, month, day] = due.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const parsed = new Date(`${due}, ${referenceYear}`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getBillDueOffsetDays(due: string, today: Date) {
  const dueDate = parseBillDueDate(due, today.getFullYear())
  if (!dueDate) {
    return null
  }

  const ms = getStartOfDay(dueDate).getTime() - getStartOfDay(today).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function getPreviousMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return ''
  }

  const [year, month] = monthKey.split('-').map(Number)
  const previous = new Date(year, month - 2, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

function exportTransactionsCsv(records: Transaction[]) {
  const header = ['Date', 'Month', 'Merchant', 'Category', 'Type', 'Amount']
  const rows = records.map((transaction) => [
    normalizeDateToIso(transaction.date) || transaction.date || 'N/A',
    getMonthKeyFromDate(transaction.date) || 'N/A',
    transaction.merchant,
    transaction.category,
    transaction.type,
    Math.round(transaction.amount).toString(),
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const file = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = 'transactions.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [monthFilter, setMonthFilter] = useState('all')
  const [sort, setSort] = useState<'newest' | 'amount-desc' | 'amount-asc'>('newest')
  const [page, setPage] = useState(1)

  const [transactions, setTransactions] = useState(initialTransactions)
  const [budgets, setBudgets] = useState(initialBudgets)
  const [pots, setPots] = useState(initialPots)
  const [bills, setBills] = useState(initialBills)

  const [expenseDate, setExpenseDate] = useState('')
  const [expenseMerchant, setExpenseMerchant] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [monthlyExpenseMonth, setMonthlyExpenseMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [monthlyExpenseMerchant, setMonthlyExpenseMerchant] = useState('')
  const [monthlyExpenseCategory, setMonthlyExpenseCategory] = useState('')
  const [monthlyExpenseAmount, setMonthlyExpenseAmount] = useState('')
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [comparisonMonth, setComparisonMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [salaryPlanMonth, setSalaryPlanMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [salaryAmount, setSalaryAmount] = useState('')
  const [spentAmount, setSpentAmount] = useState('')
  const [monthlySavedAmount, setMonthlySavedAmount] = useState('')
  const [investmentStyle, setInvestmentStyle] = useState<InvestmentStyle>('balanced')
  const [salaryPlans, setSalaryPlans] = useState<SalaryPlanRecord[]>([])
  const [salaryPlanMessage, setSalaryPlanMessage] = useState('')
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState('')
  const [sipYears, setSipYears] = useState('1')
  const [potName, setPotName] = useState('')
  const [potGoal, setPotGoal] = useState('')
  const [potSaved, setPotSaved] = useState('')
  const [potCadence, setPotCadence] = useState('Monthly auto-transfer')
  const [editingPotName, setEditingPotName] = useState('')
  const [editPotName, setEditPotName] = useState('')
  const [editPotGoal, setEditPotGoal] = useState('')
  const [editPotSaved, setEditPotSaved] = useState('')
  const [editPotCadence, setEditPotCadence] = useState('')
  const [potMessage, setPotMessage] = useState('')
  const [billName, setBillName] = useState('')
  const [billDueDate, setBillDueDate] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billStatus, setBillStatus] = useState<Bill['status']>('Upcoming')

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [, setApiConnected] = useState(false)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied'
    }

    return Notification.permission
  })
  const undoTimerRef = useRef<number | null>(null)
  const sentNotificationKeysRef = useRef<Set<string>>(new Set())

  const categories = useMemo(
    () => ['All', ...new Set(transactions.map((transaction) => transaction.category))],
    [transactions],
  )

  const expenseMonths = useMemo(() => {
    const uniqueMonths = new Set(
      transactions
        .filter((transaction) => transaction.type === 'Expense')
        .map((transaction) => getMonthKeyFromDate(transaction.date))
        .filter(Boolean),
    )

    return [...uniqueMonths].sort((left, right) => right.localeCompare(left))
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions
      .filter((transaction) => {
        const transactionMonth = getMonthKeyFromDate(transaction.date)
        const matchesCategory = category === 'All' || transaction.category === category
        const matchesMonth = monthFilter === 'all' || (transaction.type === 'Expense' && transactionMonth === monthFilter)
        const matchesSearch =
          !query ||
          transaction.merchant.toLowerCase().includes(query) ||
          transaction.category.toLowerCase().includes(query)

        return matchesCategory && matchesMonth && matchesSearch
      })
      .sort((left, right) => {
        if (sort === 'amount-desc') return Math.abs(right.amount) - Math.abs(left.amount)
        if (sort === 'amount-asc') return Math.abs(left.amount) - Math.abs(right.amount)

        return right.id - left.id
      })
  }, [category, monthFilter, search, sort, transactions])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const visibleTransactions = filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const firstVisibleIndex = filteredTransactions.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const lastVisibleIndex = Math.min(currentPage * rowsPerPage, filteredTransactions.length)

  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'Income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalExpense = Math.abs(
    transactions
      .filter((transaction) => transaction.type === 'Expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  )
  const netCashFlow = totalIncome - totalExpense
  const budgetPressure = Math.round(
    (budgets.reduce((sum, budget) => sum + budget.spent, 0) /
      Math.max(1, budgets.reduce((sum, budget) => sum + budget.limit, 0))) *
      100,
  )
  const monthlyExpenseTotal = useMemo(
    () =>
      transactions
        .filter(
          (transaction) => transaction.type === 'Expense' && getMonthKeyFromDate(transaction.date) === summaryMonth,
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [summaryMonth, transactions],
  )
  const previousComparisonMonth = useMemo(() => getPreviousMonthKey(comparisonMonth), [comparisonMonth])
  const comparisonCurrentTotal = useMemo(
    () =>
      transactions
        .filter(
          (transaction) => transaction.type === 'Expense' && getMonthKeyFromDate(transaction.date) === comparisonMonth,
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [comparisonMonth, transactions],
  )
  const comparisonPreviousTotal = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.type === 'Expense' && getMonthKeyFromDate(transaction.date) === previousComparisonMonth,
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [previousComparisonMonth, transactions],
  )
  const comparisonDelta = comparisonCurrentTotal - comparisonPreviousTotal
  const comparisonPercent = comparisonPreviousTotal
    ? Math.round((comparisonDelta / comparisonPreviousTotal) * 100)
    : null
  const salaryMonthIncomeTotal = useMemo(
    () =>
      transactions
        .filter(
          (transaction) => transaction.type === 'Income' && getMonthKeyFromDate(transaction.date) === salaryPlanMonth,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [salaryPlanMonth, transactions],
  )
  const salaryMonthExpenseTotal = useMemo(
    () =>
      transactions
        .filter(
          (transaction) => transaction.type === 'Expense' && getMonthKeyFromDate(transaction.date) === salaryPlanMonth,
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [salaryPlanMonth, transactions],
  )
  const salaryMonthRemaining = salaryMonthIncomeTotal - salaryMonthExpenseTotal
  const salaryValue = Math.max(0, Number(salaryAmount) || 0)
  const spentValue = Math.max(0, Number(spentAmount) || 0)
  const savedThisMonthValue = Math.max(0, Number(monthlySavedAmount) || 0)
  const remainingSalary = Math.max(0, salaryValue - spentValue)
  const remainingAfterGoals = remainingSalary - savedThisMonthValue
  const overspentAmount = spentValue > salaryValue ? spentValue - salaryValue : 0
  const sipMonthlyValue = Math.max(0, Number(sipMonthlyAmount) || 0)
  const sipYearsValue = Math.max(0, Number(sipYears) || 0)
  const sipMonths = Math.round(sipYearsValue * 12)
  const sipRatePerMonth = 0.12 / 12
  const sipInvestedAmount = sipMonthlyValue * sipMonths
  const sipEstimatedMaturity =
    sipMonthlyValue > 0 && sipMonths > 0
      ? sipRatePerMonth > 0
        ? sipMonthlyValue * (((1 + sipRatePerMonth) ** sipMonths - 1) / sipRatePerMonth) * (1 + sipRatePerMonth)
        : sipInvestedAmount
      : 0
  const sipEstimatedGain = Math.max(0, sipEstimatedMaturity - sipInvestedAmount)
  const salarySplit = useMemo(() => {
    const split = investmentPresets[investmentStyle].split
    const emergency = Math.round((remainingSalary * split.emergency) / 100)
    const indexFund = Math.round((remainingSalary * split.indexFund) / 100)
    const debtFund = Math.round((remainingSalary * split.debtFund) / 100)
    const liquid = Math.round((remainingSalary * split.liquid) / 100)
    const assigned = emergency + indexFund + debtFund + liquid

    return {
      emergency,
      indexFund,
      debtFund,
      liquid: liquid + (remainingSalary - assigned),
    }
  }, [investmentStyle, remainingSalary])
  const dueBillNotifications = useMemo(() => {
    const today = new Date()

    return bills
      .filter((bill) => bill.status !== 'Paid')
      .map((bill) => ({
        bill,
        dueOffset: getBillDueOffsetDays(bill.due, today),
      }))
      .filter((entry) => entry.dueOffset === 0 || entry.dueOffset === 1)
      .sort((left, right) => Number(left.dueOffset) - Number(right.dueOffset))
  }, [bills])

  const apiRequest = async (path: string, options: RequestInit = {}, authToken?: string) => {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message ?? 'Request failed')
    }

    return response.json()
  }

  const queueUndo = (action: UndoAction) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
    }

    setUndoAction(action)
    undoTimerRef.current = window.setTimeout(() => {
      setUndoAction(null)
      undoTimerRef.current = null
    }, 6000)
  }

  const clearUndo = () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoAction(null)
  }

  const enablePopNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  const useCurrentDashboardTotals = () => {
    setSalaryAmount(String(Math.max(0, Math.round(salaryMonthIncomeTotal))))
    setSpentAmount(String(Math.max(0, Math.round(salaryMonthExpenseTotal))))
    setSalaryPlanMessage(`Used tracked totals for ${formatMonthLabel(salaryPlanMonth)}.`)
  }

  const saveSalaryPlan = async () => {
    if (!/^\d{4}-\d{2}$/.test(salaryPlanMonth)) {
      setSalaryPlanMessage('Select a valid month before saving.')
      return
    }

    if (salaryValue <= 0) {
      setSalaryPlanMessage('Enter a salary amount greater than zero.')
      return
    }

    if (overspentAmount > 0) {
      setSalaryPlanMessage('You are overspent. Adjust spending before saving an investment plan.')
      return
    }

    try {
      const data = await apiRequest(
        '/api/salary-plans',
        {
          method: 'POST',
          body: JSON.stringify({
            monthKey: salaryPlanMonth,
            salary: salaryValue,
            spent: spentValue,
            investmentStyle,
          }),
        },
        token,
      )

      setSalaryPlans(data.salaryPlans ?? salaryPlans)
      setSalaryPlanMessage(`Saved plan for ${formatMonthLabel(salaryPlanMonth)}.`)
      setApiConnected(true)
    } catch (error) {
      setApiConnected(false)
      setSalaryPlanMessage(error instanceof Error ? error.message : 'Unable to save salary plan right now.')
    }
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const savedToken = localStorage.getItem('finance_token')
      if (!savedToken) {
        if (mounted) setAuthReady(true)
        return
      }

      try {
        const me = await apiRequest('/api/auth/me', {}, savedToken)
        const data = await apiRequest('/api/dashboard', {}, savedToken)
        if (!mounted) return

        setToken(savedToken)
        setUser(me.user)
        setTransactions(data.transactions ?? initialTransactions)
        setBudgets(data.budgets ?? initialBudgets)
        setPots(data.pots ?? initialPots)
        setBills(data.bills ?? initialBills)
        setSalaryPlans(data.salaryPlans ?? [])
        setApiConnected(true)
      } catch {
        if (mounted) {
          localStorage.removeItem('finance_token')
          setToken('')
          setUser(null)
          setApiConnected(false)
        }
      } finally {
        if (mounted) setAuthReady(true)
      }
    }

    load()

    return () => {
      mounted = false
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (notificationPermission !== 'granted') {
      return
    }

    dueBillNotifications.forEach(({ bill, dueOffset }) => {
      const key = `${bill.id}-${dueOffset}`
      if (sentNotificationKeysRef.current.has(key)) {
        return
      }

      sentNotificationKeysRef.current.add(key)
      const when = dueOffset === 0 ? 'today' : 'tomorrow'
      new Notification(`Bill due ${when}`, {
        body: `${bill.name} is due ${when} (${bill.due}) for ${formatMoney(bill.amount)}.`,
      })
    })
  }, [dueBillNotifications, notificationPermission])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthMessage('')

    try {
      const payload = authMode === 'register' ? { name, email, password } : { email, password }
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'

      const auth = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      localStorage.setItem('finance_token', auth.token)
      setToken(auth.token)
      setUser(auth.user)

      const data = await apiRequest('/api/dashboard', {}, auth.token)
      setTransactions(data.transactions ?? initialTransactions)
      setBudgets(data.budgets ?? initialBudgets)
      setPots(data.pots ?? initialPots)
      setBills(data.bills ?? initialBills)
      setSalaryPlans(data.salaryPlans ?? [])
      setApiConnected(true)
      setPassword('')
      setAuthMessage('Authenticated successfully.')
    } catch (error) {
      setApiConnected(false)
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.')
    }
  }

  const logout = () => {
    localStorage.removeItem('finance_token')
    setToken('')
    setUser(null)
    setApiConnected(false)
    setTransactions(initialTransactions)
    setBudgets(initialBudgets)
    setPots(initialPots)
    setBills(initialBills)
    setSalaryPlans([])
    setSalaryPlanMessage('')
    setAuthMessage('Logged out.')
  }

  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const merchant = expenseMerchant.trim()
    const categoryName = expenseCategory.trim()
    const amountValue = Number(expenseAmount)
    const dateValue = expenseDate.trim()

    if (!merchant || !categoryName || !dateValue || !Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }

    const amount = -Math.abs(amountValue)
    const newTransaction: Transaction = {
      id: Date.now(),
      date: dateValue,
      merchant,
      category: categoryName,
      type: 'Expense',
      amount,
    }

    try {
      const data = await apiRequest(
        '/api/transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            date: dateValue,
            merchant,
            category: categoryName,
            type: 'Expense',
            amount: Math.abs(amount),
          }),
        },
        token,
      )

      setTransactions(data.transactions ?? [newTransaction, ...transactions])
      setBudgets(data.budgets ?? budgets)
      setApiConnected(true)
    } catch {
      setTransactions((currentTransactions) => [newTransaction, ...currentTransactions])
      setBudgets((currentBudgets) =>
        currentBudgets.map((budget) =>
          budget.category.toLowerCase() === categoryName.toLowerCase()
            ? { ...budget, spent: budget.spent + Math.abs(amount) }
            : budget,
        ),
      )
      setApiConnected(false)
    }

    setPage(1)
    setExpenseMerchant('')
    setExpenseCategory('')
    setExpenseAmount('')
    setExpenseDate('')
  }

  const movePot = async (index: number, direction: 1 | -1) => {
    const selectedPot = pots[index]
    if (!selectedPot) return

    try {
      const data = await apiRequest(
        `/api/pots/${encodeURIComponent(selectedPot.name)}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ direction }),
        },
        token,
      )

      setPots(data.pots ?? pots)
      setApiConnected(true)
      return
    } catch {
      setApiConnected(false)
    }

    setPots((currentPots) =>
      currentPots.map((pot, currentIndex) => {
        if (currentIndex !== index) return pot

        const step = Math.round(pot.goal * 0.05)
        const nextSaved = Math.max(0, Math.min(pot.goal, pot.saved + direction * step))

        return { ...pot, saved: nextSaved }
      }),
    )
  }

  const removePot = async (potName: string) => {
    try {
      const data = await apiRequest(
        `/api/pots/${encodeURIComponent(potName)}`,
        {
          method: 'DELETE',
        },
        token,
      )

      setPots(data.pots ?? pots.filter((pot) => pot.name !== potName))
      setApiConnected(true)
      return
    } catch {
      setApiConnected(false)
    }

    setPots((currentPots) => currentPots.filter((pot) => pot.name !== potName))
  }

  const addPot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nameValue = potName.trim()
    const goalValue = Number(potGoal)
    const savedValue = Number(potSaved || '0')
    const cadenceValue = potCadence.trim() || 'Monthly auto-transfer'

    if (!nameValue || !Number.isFinite(goalValue) || goalValue <= 0 || !Number.isFinite(savedValue) || savedValue < 0) {
      setPotMessage('Enter a valid pot name, goal amount, and optional saved amount.')
      return
    }

    const newPot: Pot = {
      name: nameValue,
      goal: goalValue,
      saved: Math.min(savedValue, goalValue),
      cadence: cadenceValue,
    }

    if (pots.some((pot) => pot.name.toLowerCase() === nameValue.toLowerCase())) {
      setPotMessage('A pot with this name already exists.')
      return
    }

    try {
      const data = await apiRequest(
        '/api/pots',
        {
          method: 'POST',
          body: JSON.stringify(newPot),
        },
        token,
      )

      setPots(data.pots ?? [newPot, ...pots])
      setApiConnected(true)
      setPotMessage(`Saving pot "${nameValue}" added.`)
    } catch (error) {
      setApiConnected(false)
      setPots((currentPots) => [newPot, ...currentPots])
      setPotMessage(error instanceof Error ? error.message : 'Unable to add saving pot right now.')
    }

    setPotName('')
    setPotGoal('')
    setPotSaved('')
    setPotCadence('Monthly auto-transfer')
  }

  const startEditPot = (pot: Pot) => {
    setEditingPotName(pot.name)
    setEditPotName(pot.name)
    setEditPotGoal(String(Math.round(pot.goal)))
    setEditPotSaved(String(Math.round(pot.saved)))
    setEditPotCadence(pot.cadence)
    setPotMessage('')
  }

  const cancelEditPot = () => {
    setEditingPotName('')
    setEditPotName('')
    setEditPotGoal('')
    setEditPotSaved('')
    setEditPotCadence('')
  }

  const saveEditedPot = async (originalName: string) => {
    const nameValue = editPotName.trim()
    const goalValue = Number(editPotGoal)
    const savedValue = Number(editPotSaved)
    const cadenceValue = editPotCadence.trim() || 'Monthly auto-transfer'

    if (!nameValue || !Number.isFinite(goalValue) || goalValue <= 0 || !Number.isFinite(savedValue) || savedValue < 0) {
      setPotMessage('Enter valid values before saving the pot.')
      return
    }

    if (
      nameValue.toLowerCase() !== originalName.toLowerCase() &&
      pots.some((pot) => pot.name.toLowerCase() === nameValue.toLowerCase())
    ) {
      setPotMessage('A pot with this name already exists.')
      return
    }

    const updatedPot: Pot = {
      name: nameValue,
      goal: goalValue,
      saved: Math.min(savedValue, goalValue),
      cadence: cadenceValue,
    }

    try {
      const data = await apiRequest(
        `/api/pots/${encodeURIComponent(originalName)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            newName: updatedPot.name,
            goal: updatedPot.goal,
            saved: updatedPot.saved,
            cadence: updatedPot.cadence,
          }),
        },
        token,
      )

      setPots(data.pots ?? pots)
      setApiConnected(true)
      setPotMessage(`Saving pot "${updatedPot.name}" updated.`)
      cancelEditPot()
      return
    } catch (error) {
      setApiConnected(false)
      setPotMessage(error instanceof Error ? error.message : 'Unable to update saving pot right now.')
    }

    setPots((currentPots) =>
      currentPots.map((pot) => (pot.name === originalName ? updatedPot : pot)),
    )
    setPotMessage(`Saving pot "${updatedPot.name}" updated in offline mode.`)
    cancelEditPot()
  }

  const addBill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nameValue = billName.trim()
    const dueValue = billDueDate.trim()
    const amountValue = Number(billAmount)

    if (!nameValue || !dueValue || !Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }

    const newBill: Bill = {
      id: Date.now(),
      name: nameValue,
      due: dueValue,
      status: billStatus,
      amount: Math.abs(amountValue),
    }

    try {
      const data = await apiRequest(
        '/api/bills',
        {
          method: 'POST',
          body: JSON.stringify(newBill),
        },
        token,
      )

      setBills(data.bills ?? [newBill, ...bills])
      setApiConnected(true)
    } catch {
      setBills((currentBills) => [newBill, ...currentBills])
      setApiConnected(false)
    }

    setBillName('')
    setBillDueDate('')
    setBillAmount('')
    setBillStatus('Upcoming')
  }

  const addMonthlyExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const merchant = monthlyExpenseMerchant.trim()
    const categoryName = monthlyExpenseCategory.trim()
    const amountValue = Number(monthlyExpenseAmount)
    const dateValue = `${monthlyExpenseMonth}-01`

    if (!merchant || !categoryName || !monthlyExpenseMonth || !Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }

    const amount = -Math.abs(amountValue)
    const newTransaction: Transaction = {
      id: Date.now(),
      date: dateValue,
      merchant,
      category: categoryName,
      type: 'Expense',
      amount,
    }

    try {
      const data = await apiRequest(
        '/api/transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            date: dateValue,
            merchant,
            category: categoryName,
            type: 'Expense',
            amount: Math.abs(amount),
          }),
        },
        token,
      )

      setTransactions(data.transactions ?? [newTransaction, ...transactions])
      setBudgets(data.budgets ?? budgets)
      setApiConnected(true)
    } catch {
      setTransactions((currentTransactions) => [newTransaction, ...currentTransactions])
      setBudgets((currentBudgets) =>
        currentBudgets.map((budget) =>
          budget.category.toLowerCase() === categoryName.toLowerCase()
            ? { ...budget, spent: budget.spent + Math.abs(amount) }
            : budget,
        ),
      )
      setApiConnected(false)
    }

    setPage(1)
    setMonthlyExpenseMerchant('')
    setMonthlyExpenseCategory('')
    setMonthlyExpenseAmount('')
    setSummaryMonth(monthlyExpenseMonth)
  }

  const removePaidBills = async () => {
    const removedPaidBills = bills.filter((bill) => bill.status === 'Paid')
    if (removedPaidBills.length === 0) return

    try {
      const data = await apiRequest(
        '/api/bills/paid',
        {
          method: 'DELETE',
        },
        token,
      )

      setBills(data.bills ?? bills.filter((bill) => bill.status !== 'Paid'))
      setApiConnected(true)
      queueUndo({
        kind: 'paid-bills',
        bills: removedPaidBills,
        message: `${removedPaidBills.length} paid bill${removedPaidBills.length > 1 ? 's' : ''} removed.`,
      })
      return
    } catch {
      setApiConnected(false)
    }

    setBills((currentBills) => currentBills.filter((bill) => bill.status !== 'Paid'))
    queueUndo({
      kind: 'paid-bills',
      bills: removedPaidBills,
      message: `${removedPaidBills.length} paid bill${removedPaidBills.length > 1 ? 's' : ''} removed.`,
    })
  }

  const removeBill = async (billId: number) => {
    const removedBill = bills.find((bill) => bill.id === billId)
    if (!removedBill) return

    try {
      const data = await apiRequest(
        `/api/bills/${billId}`,
        {
          method: 'DELETE',
        },
        token,
      )

      setBills(data.bills ?? bills.filter((bill) => bill.id !== billId))
      setApiConnected(true)
      queueUndo({ kind: 'bill', bill: removedBill, message: `Bill "${removedBill.name}" removed.` })
      return
    } catch {
      setApiConnected(false)
    }

    setBills((currentBills) => currentBills.filter((bill) => bill.id !== billId))
    queueUndo({ kind: 'bill', bill: removedBill, message: `Bill "${removedBill.name}" removed.` })
  }

  const removeTransaction = async (transactionId: number) => {
    const removedTransaction = transactions.find((transaction) => transaction.id === transactionId)
    if (!removedTransaction) return

    try {
      const data = await apiRequest(
        `/api/transactions/${transactionId}`,
        {
          method: 'DELETE',
        },
        token,
      )

      setTransactions(data.transactions ?? transactions.filter((transaction) => transaction.id !== transactionId))
      setBudgets(data.budgets ?? budgets)
      setApiConnected(true)
      queueUndo({
        kind: 'transaction',
        transaction: removedTransaction,
        message: `Transaction "${removedTransaction.merchant}" removed.`,
      })
      return
    } catch {
      setApiConnected(false)
    }

    setTransactions((currentTransactions) => currentTransactions.filter((transaction) => transaction.id !== transactionId))
    if (removedTransaction.type === 'Expense') {
      setBudgets((currentBudgets) =>
        currentBudgets.map((budget) =>
          budget.category.toLowerCase() === removedTransaction.category.toLowerCase()
            ? { ...budget, spent: Math.max(0, budget.spent - Math.abs(removedTransaction.amount)) }
            : budget,
        ),
      )
    }
    queueUndo({
      kind: 'transaction',
      transaction: removedTransaction,
      message: `Transaction "${removedTransaction.merchant}" removed.`,
    })
  }

  const undoLastDelete = async () => {
    if (!undoAction) return

    const action = undoAction
    clearUndo()

    try {
      if (action.kind === 'transaction') {
        const data = await apiRequest(
          '/api/transactions',
          {
            method: 'POST',
            body: JSON.stringify({
              date: action.transaction.date,
              merchant: action.transaction.merchant,
              category: action.transaction.category,
              type: action.transaction.type,
              amount: Math.abs(action.transaction.amount),
            }),
          },
          token,
        )
        setTransactions(data.transactions ?? [action.transaction, ...transactions])
        setBudgets(data.budgets ?? budgets)
      }

      if (action.kind === 'bill') {
        const data = await apiRequest(
          '/api/bills',
          {
            method: 'POST',
            body: JSON.stringify({
              name: action.bill.name,
              due: action.bill.due,
              status: action.bill.status,
              amount: action.bill.amount,
            }),
          },
          token,
        )
        setBills(data.bills ?? [action.bill, ...bills])
      }

      if (action.kind === 'paid-bills') {
        await Promise.all(
          action.bills.map((bill) =>
            apiRequest(
              '/api/bills',
              {
                method: 'POST',
                body: JSON.stringify({
                  name: bill.name,
                  due: bill.due,
                  status: bill.status,
                  amount: bill.amount,
                }),
              },
              token,
            ),
          ),
        )
        const data = await apiRequest('/api/dashboard', {}, token)
        setBills(data.bills ?? bills)
      }

      setApiConnected(true)
    } catch {
      setApiConnected(false)

      if (action.kind === 'transaction') {
        setTransactions((currentTransactions) => [action.transaction, ...currentTransactions])
      }

      if (action.kind === 'bill') {
        setBills((currentBills) => [action.bill, ...currentBills])
      }

      if (action.kind === 'paid-bills') {
        setBills((currentBills) => [...action.bills, ...currentBills])
      }
    }
  }

  if (!authReady) {
    return (
      <main className="login-shell" aria-live="polite">
        <section className="login-card loading-card" aria-label="Loading authentication">
          <p className="section-kicker">Personal finance manager</p>
          <h1>Checking your secure session...</h1>
          <p className="hero-text">Please wait while we verify your account.</p>
        </section>
      </main>
    )
  }

  if (!token || !user) {
    return (
      <main className="login-shell">
        <section className="login-card" aria-label="Authentication">
          <p className="section-kicker">Welcome back</p>
          <h1>Login to your finance dashboard</h1>
          <p className="hero-text">Use your account to access transactions, budgets, saving pots, and recurring bills.</p>

          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-toggle">
              <button
                type="button"
                className={`button button-secondary ${authMode === 'login' ? 'is-active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`button button-secondary ${authMode === 'register' ? 'is-active' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>

            <div className="auth-grid">
              {authMode === 'register' && (
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  required
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                minLength={6}
                required
              />
            </div>

            <button type="submit" className="button button-primary">
              {authMode === 'register' ? 'Create account' : 'Login'}
            </button>
          </form>

          {authMessage && <span className="auth-message">{authMessage}</span>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="app-layout">
        <aside className="feature-sidebar" aria-label="Feature navigation">
          <p className="section-kicker">Quick access</p>
          <nav>
            <a href="#overview" className="feature-link">Overview</a>
            <a href="#notifications" className="feature-link">Notifications</a>
            <a href="#transactions" className="feature-link">Transactions</a>
            <a href="#pots" className="feature-link">Saving pots</a>
            <a href="#salary-plan" className="feature-link">Salary plan</a>
            <a href="#bills" className="feature-link">Recurring bills</a>
            <a href="#profile" className="feature-link">Profile</a>
          </nav>
        </aside>

        <div className="app-content">
          <header id="overview" className="hero-card" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="eyebrow">Personal finance manager</p>
              <h1 id="hero-title">Track spending, budgets, pots, and bills in one sharp dashboard.</h1>

              <div className="auth-card">
                <div className="auth-row">
                  <span>Signed in as {user.name}</span>
                  <span>{user.email}</span>
                </div>
                {authMessage && <span className="auth-message">{authMessage}</span>}
              </div>

              <dl className="hero-metrics" aria-label="Dashboard highlights">
                <div>
                  <dt>Budget pressure</dt>
                  <dd>{budgetPressure}%</dd>
                </div>
                <div>
                  <dt>Net cash flow</dt>
                  <dd>{formatMoney(netCashFlow)}</dd>
                </div>
                <div>
                  <dt>Open bills</dt>
                  <dd>{bills.filter((bill) => bill.status !== 'Paid').length}</dd>
                </div>
                <div>
                  <dt>Saving pots</dt>
                  <dd>{pots.length}</dd>
                </div>
              </dl>
            </div>
          </header>

          <section id="transactions" className="table-section" aria-labelledby="transactions-title">
            <div id="notifications" className="section-card notification-card" aria-live="polite">
              <p className="section-kicker">Notifications</p>
              <h2>Bills due today and tomorrow</h2>
              <div className="notification-controls">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={enablePopNotifications}
                  disabled={notificationPermission === 'granted'}
                >
                  {notificationPermission === 'granted' ? 'Pop-up alerts enabled' : 'Enable pop-up alerts'}
                </button>
                <span className="text-link">
                  {notificationPermission === 'granted'
                    ? 'Browser pop-up alerts are active.'
                    : 'Enable browser permission to receive pop-up alerts for due bills.'}
                </span>
              </div>
              {dueBillNotifications.length === 0 ? (
                <p className="text-link">No unpaid bills due in the next 24 hours.</p>
              ) : (
                <div className="notification-list">
                  {dueBillNotifications.map(({ bill, dueOffset }) => (
                    <div className="notification-item" key={`notice-${bill.id}`}>
                      <strong>{bill.name}</strong>
                      <span className={`notification-pill ${dueOffset === 0 ? 'is-today' : 'is-tomorrow'}`}>
                        {dueOffset === 0 ? 'Due today' : 'Due tomorrow'}
                      </span>
                      <span>{bill.due}</span>
                      <span>{formatMoney(bill.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="section-heading">
              <div>
                <p className="section-kicker">Transactions</p>
                <h2 id="transactions-title">Search, sort, and page through activity</h2>
              </div>
              <span className="text-link">Showing {firstVisibleIndex}-{lastVisibleIndex} of {filteredTransactions.length} matching records</span>
            </div>

            <div className="table-card">
              <form className="expense-form" onSubmit={addExpense} aria-label="Add expense form">
                <div className="expense-form-head">
                  <div>
                    <p className="section-kicker">Add expense</p>
                    <h3>Enter a new spending record</h3>
                  </div>
                  <span className="text-link">Expenses update the transaction list and matching budget total.</span>
                </div>
                <div className="expense-grid">
                  <label>
                    <span>Date</span>
                    <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
                  </label>
                  <label>
                    <span>Merchant</span>
                    <input type="text" value={expenseMerchant} onChange={(event) => setExpenseMerchant(event.target.value)} placeholder="Bookstore" />
                  </label>
                  <label>
                    <span>Category</span>
                    <input list="category-options" type="text" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Shopping" />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input type="number" min="1" step="1" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="520" />
                  </label>
                </div>
                <datalist id="category-options">
                  {categories.filter((item) => item !== 'All').map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <button type="submit" className="button button-primary add-expense-button">Add expense</button>
              </form>

              <form className="expense-form monthly-expense-form" onSubmit={addMonthlyExpense} aria-label="Add monthly expense form">
                <div className="expense-form-head">
                  <div>
                    <p className="section-kicker">Add monthly expense</p>
                    <h3>Add an expense to a selected month</h3>
                  </div>
                  <span className="text-link">Useful for rent, subscriptions, and other monthly payments.</span>
                </div>
                <div className="expense-grid">
                  <label>
                    <span>Month</span>
                    <input type="month" value={monthlyExpenseMonth} onChange={(event) => setMonthlyExpenseMonth(event.target.value)} />
                  </label>
                  <label>
                    <span>Merchant</span>
                    <input type="text" value={monthlyExpenseMerchant} onChange={(event) => setMonthlyExpenseMerchant(event.target.value)} placeholder="House rent" />
                  </label>
                  <label>
                    <span>Category</span>
                    <input list="category-options" type="text" value={monthlyExpenseCategory} onChange={(event) => setMonthlyExpenseCategory(event.target.value)} placeholder="Housing" />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input type="number" min="1" step="1" value={monthlyExpenseAmount} onChange={(event) => setMonthlyExpenseAmount(event.target.value)} placeholder="18000" />
                  </label>
                </div>
                <button type="submit" className="button button-primary add-expense-button">Add monthly expense</button>
              </form>

              <div className="table-actions monthly-summary">
                <label className="month-picker">
                  <span>Summary month</span>
                  <input type="month" value={summaryMonth} onChange={(event) => setSummaryMonth(event.target.value)} />
                </label>
                <span className="text-link">Total expenses in {formatMonthLabel(summaryMonth)}: {formatMoney(monthlyExpenseTotal)}</span>
              </div>

              <div className="table-actions monthly-comparison">
                <label className="month-picker">
                  <span>Comparison month</span>
                  <input
                    type="month"
                    value={comparisonMonth}
                    onChange={(event) => setComparisonMonth(event.target.value)}
                  />
                </label>
                <div className="comparison-details">
                  <span className="text-link">
                    {formatMonthLabel(comparisonMonth)}: {formatMoney(comparisonCurrentTotal)}
                  </span>
                  <span className="text-link">
                    {formatMonthLabel(previousComparisonMonth)}: {formatMoney(comparisonPreviousTotal)}
                  </span>
                  <strong className={comparisonDelta > 0 ? 'delta-negative' : comparisonDelta < 0 ? 'delta-positive' : ''}>
                    Difference: {comparisonDelta > 0 ? '+' : ''}{formatMoney(comparisonDelta)}
                    {comparisonPercent !== null ? ` (${comparisonPercent > 0 ? '+' : ''}${comparisonPercent}%)` : ''}
                  </strong>
                </div>
              </div>

              <div className="table-actions">
                <span className="text-link">Export the filtered transaction view or download the full report after refining the search.</span>
                <button type="button" className="button button-secondary" onClick={() => exportTransactionsCsv(filteredTransactions)} disabled={filteredTransactions.length === 0}>
                  Export CSV
                </button>
              </div>

              <div className="control-grid" aria-label="Transaction controls">
                <label>
                  <span>Search merchant or category</span>
                  <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Try groceries or rent" />
                </label>

                <label>
                  <span>Category</span>
                  <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}>
                    {categories.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Spent month</span>
                  <select value={monthFilter} onChange={(event) => { setMonthFilter(event.target.value); setPage(1) }}>
                    <option value="all">All months</option>
                    {expenseMonths.map((month) => (
                      <option key={month} value={month}>{formatMonthLabel(month)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                    <option value="newest">Newest first</option>
                    <option value="amount-desc">Largest amount</option>
                    <option value="amount-asc">Smallest amount</option>
                  </select>
                </label>
              </div>

              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Merchant</th>
                    <th scope="col">Category</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="align-right">Amount</th>
                    <th scope="col" className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => (
                    <tr key={transaction.id} tabIndex={0}>
                      <td>{transaction.date}</td>
                      <td>{transaction.merchant}</td>
                      <td>{transaction.category}</td>
                      <td><span className={`status-chip status-${transaction.type.toLowerCase()}`}>{transaction.type}</span></td>
                      <td className={`align-right ${transaction.amount >= 0 ? 'money-positive' : 'money-negative'}`}>{formatMoney(transaction.amount)}</td>
                      <td className="align-right">
                        <button
                          type="button"
                          className="button button-secondary table-action-button"
                          onClick={() => removeTransaction(transaction.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination-bar" aria-label="Transaction pagination">
                <button type="button" className="button button-secondary" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" className="button button-secondary" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          </section>

          <section id="pots" className="table-section" aria-labelledby="pots-title">
            <article className="section-card">
              <p className="section-kicker">Saving pots</p>
              <h2 id="pots-title">Deposit and withdraw against goals</h2>
              <form className="expense-form" onSubmit={addPot} aria-label="Add saving pot form">
                <div className="expense-form-head">
                  <div>
                    <p className="section-kicker">Add saving pot</p>
                    <h3>Create a new savings goal</h3>
                  </div>
                  <span className="text-link">Set a goal, optional current savings, and transfer cadence.</span>
                </div>
                <div className="expense-grid">
                  <label>
                    <span>Pot name</span>
                    <input type="text" value={potName} onChange={(event) => setPotName(event.target.value)} placeholder="Car fund" />
                  </label>
                  <label>
                    <span>Goal amount</span>
                    <input type="number" min="1" step="1" value={potGoal} onChange={(event) => setPotGoal(event.target.value)} placeholder="250000" />
                  </label>
                  <label>
                    <span>Already saved</span>
                    <input type="number" min="0" step="1" value={potSaved} onChange={(event) => setPotSaved(event.target.value)} placeholder="25000" />
                  </label>
                  <label>
                    <span>Cadence</span>
                    <input type="text" value={potCadence} onChange={(event) => setPotCadence(event.target.value)} placeholder="Monthly auto-transfer" />
                  </label>
                </div>
                <button type="submit" className="button button-primary add-expense-button">Add saving pot</button>
                {potMessage && <span className="auth-message">{potMessage}</span>}
              </form>
              <div className="progress-list">
                {pots.map((pot, index) => {
                  const progress = Math.round((pot.saved / pot.goal) * 100)
                  const isEditing = editingPotName === pot.name
                  return (
                    <div className="progress-item" key={pot.name}>
                      <div className="progress-labels">
                        <strong>{pot.name}</strong>
                        <span>{formatMoney(pot.saved)} of {formatMoney(pot.goal)}</span>
                      </div>
                      <div className="progress-track progress-track-alt" aria-hidden="true">
                        <div className="progress-fill progress-fill-alt" style={{ width: `${progress}%` }} />
                      </div>
                      {isEditing && (
                        <div className="pot-edit-grid" aria-label={`Edit ${pot.name} saving pot`}>
                          <label>
                            <span>Name</span>
                            <input type="text" value={editPotName} onChange={(event) => setEditPotName(event.target.value)} />
                          </label>
                          <label>
                            <span>Goal</span>
                            <input type="number" min="1" step="1" value={editPotGoal} onChange={(event) => setEditPotGoal(event.target.value)} />
                          </label>
                          <label>
                            <span>Saved</span>
                            <input type="number" min="0" step="1" value={editPotSaved} onChange={(event) => setEditPotSaved(event.target.value)} />
                          </label>
                          <label>
                            <span>Cadence</span>
                            <input type="text" value={editPotCadence} onChange={(event) => setEditPotCadence(event.target.value)} />
                          </label>
                        </div>
                      )}
                      <div className="pot-actions">
                        <button type="button" className="button button-secondary" onClick={() => movePot(index, 1)}>Add money</button>
                        <button type="button" className="button button-secondary" onClick={() => movePot(index, -1)}>Withdraw</button>
                        {isEditing ? (
                          <>
                            <button type="button" className="button button-primary" onClick={() => saveEditedPot(pot.name)}>Save</button>
                            <button type="button" className="button button-secondary" onClick={cancelEditPot}>Cancel</button>
                          </>
                        ) : (
                          <button type="button" className="button button-secondary" onClick={() => startEditPot(pot)}>Edit</button>
                        )}
                        <button type="button" className="button button-secondary table-action-button" onClick={() => removePot(pot.name)}>Remove</button>
                      </div>
                      <span className="progress-pct">{progress}% to goal · {pot.cadence}</span>
                    </div>
                  )
                })}
              </div>
            </article>
          </section>

          <section id="salary-plan" className="table-section" aria-labelledby="salary-plan-title">
            <div className="salary-plan-layout">
              <article className="section-card salary-plan-card salary-plan-calculation">
                <p className="section-kicker">Salary planner</p>
                <h2 id="salary-plan-title">Calculate remaining salary and auto-suggest investments</h2>
                <p className="text-link">Enter your salary and spending for the month, then choose a style to get an instant investment split.</p>

                <div className="salary-plan-controls">
                  <label>
                    <span>Plan month</span>
                    <input
                      type="month"
                      value={salaryPlanMonth}
                      onChange={(event) => setSalaryPlanMonth(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Total salary this month</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={salaryAmount}
                      onChange={(event) => setSalaryAmount(event.target.value)}
                      placeholder="80000"
                    />
                  </label>
                  <label>
                    <span>Total spent this month</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={spentAmount}
                      onChange={(event) => setSpentAmount(event.target.value)}
                      placeholder="50000"
                    />
                  </label>
                  <label>
                    <span>Saved this month for goals</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={monthlySavedAmount}
                      onChange={(event) => setMonthlySavedAmount(event.target.value)}
                      placeholder="2500"
                    />
                  </label>
                  <label>
                    <span>Investment style</span>
                    <select
                      value={investmentStyle}
                      onChange={(event) => setInvestmentStyle(event.target.value as InvestmentStyle)}
                    >
                      {Object.entries(investmentPresets).map(([key, preset]) => (
                        <option key={key} value={key}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="salary-plan-actions">
                  <button type="button" className="button button-secondary" onClick={useCurrentDashboardTotals}>
                    Use selected month totals
                  </button>
                  <button type="button" className="button button-primary" onClick={saveSalaryPlan}>
                    Save this plan
                  </button>
                </div>

                <div className="salary-plan-note">
                  <p>
                    Tracked for {formatMonthLabel(salaryPlanMonth)}: Income {formatMoney(salaryMonthIncomeTotal)} · Expenses {formatMoney(salaryMonthExpenseTotal)} · Remaining {formatMoney(salaryMonthRemaining)}
                  </p>
                  <p>
                    Saved this month: {formatMoney(savedThisMonthValue)} · Remaining after goals: {formatMoney(remainingAfterGoals)}
                  </p>
                </div>
                {salaryPlanMessage && <span className="auth-message">{salaryPlanMessage}</span>}

                <div className="salary-summary-grid" aria-label="Salary summary">
                  <div>
                    <dt>Total salary</dt>
                    <dd>{formatMoney(salaryValue)}</dd>
                  </div>
                  <div>
                    <dt>Total spent</dt>
                    <dd>{formatMoney(spentValue)}</dd>
                  </div>
                  <div>
                    <dt>Remaining amount</dt>
                    <dd>{formatMoney(remainingSalary)}</dd>
                  </div>
                  <div>
                    <dt>Saved this month</dt>
                    <dd>{formatMoney(savedThisMonthValue)}</dd>
                  </div>
                  <div>
                    <dt>Remaining after goals</dt>
                    <dd className={remainingAfterGoals < 0 ? 'money-negative' : remainingAfterGoals > 0 ? 'money-positive' : ''}>
                      {formatMoney(remainingAfterGoals)}
                    </dd>
                  </div>
                </div>

                {overspentAmount > 0 ? (
                  <p className="auth-message">You are overspent by {formatMoney(overspentAmount)}. Reduce expenses first, then restart this investment plan.</p>
                ) : null}
              </article>

              <article className="section-card salary-plan-card salary-plan-recommendations">
                <p className="section-kicker">Plan breakdown</p>
                <h3>Investment suggestions</h3>
                <p className="text-link">{investmentPresets[investmentStyle].note}</p>

                <div className="salary-split-grid" aria-label="Investment split suggestions">
                  <div className="insight-card">
                    <span>Emergency fund</span>
                    <strong>{formatMoney(salarySplit.emergency)}</strong>
                    <p>Target 6 months of core expenses before increasing risk.</p>
                  </div>
                  <div className="insight-card">
                    <span>Index fund SIP</span>
                    <strong>{formatMoney(salarySplit.indexFund)}</strong>
                    <p>Primary long-term wealth builder with disciplined monthly investing.</p>
                  </div>
                  <div className="insight-card">
                    <span>Debt allocation</span>
                    <strong>{formatMoney(salarySplit.debtFund)}</strong>
                    <p>Add stability through debt funds or fixed-income instruments.</p>
                  </div>
                  <div className="insight-card">
                    <span>Liquid reserve</span>
                    <strong>{formatMoney(salarySplit.liquid)}</strong>
                    <p>Keep this portion accessible for near-term goals or sudden needs.</p>
                  </div>
                </div>

                <div className="salary-history-panel" aria-label="Saved salary plans">
                  <h3>Saved monthly plans</h3>
                  {salaryPlans.length === 0 ? (
                    <p className="text-link">No plans saved yet. Save your first month to build history.</p>
                  ) : (
                    <div className="salary-history-list">
                      {salaryPlans.map((plan) => (
                        <article key={`${plan.monthKey}-${plan.id}`} className="salary-history-item">
                          <div>
                            <strong>{formatMonthLabel(plan.monthKey)}</strong>
                            <span className="status-chip">{investmentPresets[plan.investmentStyle].label}</span>
                          </div>
                          <p>
                            Salary {formatMoney(plan.salary)} · Spent {formatMoney(plan.spent)} · Remaining {formatMoney(plan.remaining)}
                          </p>
                          <p>
                            Emergency {formatMoney(plan.emergency)} · Index {formatMoney(plan.indexFund)} · Debt {formatMoney(plan.debtFund)} · Liquid {formatMoney(plan.liquid)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sip-calculator" aria-label="SIP calculator">
                  <div className="sip-calculator-head">
                    <div>
                      <p className="section-kicker">SIP calculator</p>
                      <h3>12% annual growth estimate</h3>
                    </div>
                    <span className="text-link">Simple estimate for monthly SIP growth</span>
                  </div>

                  <div className="sip-calculator-grid">
                    <label>
                      <span>Monthly SIP</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={sipMonthlyAmount}
                        onChange={(event) => setSipMonthlyAmount(event.target.value)}
                        placeholder="5000"
                      />
                    </label>
                    <label>
                      <span>Years</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={sipYears}
                        onChange={(event) => setSipYears(event.target.value)}
                        placeholder="1"
                      />
                    </label>
                  </div>

                  <div className="sip-calculator-results">
                    <div>
                      <dt>Total invested</dt>
                      <dd>{formatMoney(sipInvestedAmount)}</dd>
                    </div>
                    <div>
                      <dt>Estimated gain</dt>
                      <dd className={sipEstimatedGain > 0 ? 'money-positive' : ''}>{formatMoney(sipEstimatedGain)}</dd>
                    </div>
                    <div>
                      <dt>Estimated maturity</dt>
                      <dd>{formatMoney(sipEstimatedMaturity)}</dd>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section id="bills" className="table-section" aria-labelledby="bills-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Recurring bills</p>
                <h2 id="bills-title">Current month status and due dates</h2>
              </div>
              <div className="hero-actions">
                <span className="text-link">Detected from transaction patterns</span>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={removePaidBills}
                  disabled={!bills.some((bill) => bill.status === 'Paid')}
                >
                  Remove paid bills
                </button>
              </div>
            </div>

            <div className="table-card">
              <form className="expense-form" onSubmit={addBill} aria-label="Add recurring bill form">
                <div className="expense-form-head">
                  <div>
                    <p className="section-kicker">Add bill</p>
                    <h3>Create a bill with due date</h3>
                  </div>
                  <span className="text-link">Set the due date now and track payment status later.</span>
                </div>
                <div className="expense-grid">
                  <label>
                    <span>Bill name</span>
                    <input type="text" value={billName} onChange={(event) => setBillName(event.target.value)} placeholder="Water bill" />
                  </label>
                  <label>
                    <span>Due date</span>
                    <input type="date" value={billDueDate} onChange={(event) => setBillDueDate(event.target.value)} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={billStatus} onChange={(event) => setBillStatus(event.target.value as Bill['status'])}>
                      <option value="Upcoming">Upcoming</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </label>
                  <label>
                    <span>Amount</span>
                    <input type="number" min="1" step="1" value={billAmount} onChange={(event) => setBillAmount(event.target.value)} placeholder="1500" />
                  </label>
                </div>
                <button type="submit" className="button button-primary add-expense-button">Add bill</button>
              </form>

              <table>
                <thead>
                  <tr>
                    <th scope="col">Bill</th>
                    <th scope="col">Due</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="align-right">Amount</th>
                    <th scope="col" className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const dueOffset = getBillDueOffsetDays(bill.due, new Date())
                    const dueClassName = dueOffset === 0 ? 'due-today-row' : dueOffset === 1 ? 'due-tomorrow-row' : ''

                    return (
                    <tr key={bill.id} className={dueClassName}>
                      <td>{bill.name}</td>
                      <td>
                        {bill.due}
                        {bill.status !== 'Paid' && dueOffset === 0 && <span className="due-tag">Today</span>}
                        {bill.status !== 'Paid' && dueOffset === 1 && <span className="due-tag">Tomorrow</span>}
                      </td>
                      <td><span className={`status-chip status-${bill.status.toLowerCase()}`}>{bill.status}</span></td>
                      <td className="align-right">{formatMoney(bill.amount)}</td>
                      <td className="align-right">
                        <button type="button" className="button button-secondary" onClick={() => removeBill(bill.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section id="profile" className="footer-card profile-footer" aria-labelledby="profile-title">
            <div>
              <p className="section-kicker">Profile</p>
              <h2 id="profile-title">Account settings and session control</h2>
              <p>Name: {user.name}</p>
              <p>Email: {user.email}</p>
            </div>
            <div className="hero-actions footer-actions">
              <button type="button" className="button button-secondary" onClick={logout}>Logout</button>
            </div>
          </section>

          {undoAction && (
            <div className="undo-toast" role="status" aria-live="polite">
              <span>{undoAction.message}</span>
              <button type="button" className="button button-secondary table-action-button" onClick={undoLastDelete}>
                Undo
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default App
