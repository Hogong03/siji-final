/**
 * 账单列表数据 — 加载、筛选、统计、分组
 */
import { ref, computed } from 'vue'
import { getBillList, getMonthlyBudget, getCategoryBudgets } from '@/utils/storage.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES } from '@/utils/categories.js'

export function useBillList() {
  const allBills = ref([])
  const currentMonth = ref('')
  const filterType = ref(-1)
  const filterCategory = ref('')
  const searchKeyword = ref('')
  const budget = ref(0)
  const catBudgets = ref({})
  const monthList = ref([])

  const months = computed(() => monthList.value)

  function initMonths() {
    const list = [{ key: 'all', label: '全部时间' }]
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      list.push({ key, label: `${d.getFullYear()}年${d.getMonth() + 1}月` })
    }
    monthList.value = list
  }

  const currentMonthLabel = computed(() => {
    const m = months.value.find(m => m.key === currentMonth.value)
    return m ? m.label : ''
  })

  const currentCategories = computed(() => {
    if (filterType.value === 0) return EXPENSE_CATEGORIES
    if (filterType.value === 1) return INCOME_CATEGORIES
    return ALL_CATEGORIES
  })

  function loadBills() {
    if (currentMonth.value === 'all') {
      const all = []
      for (const m of months.value) {
        if (m.key === 'all') continue
        all.push(...getBillList(m.key))
      }
      allBills.value = all.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))
    } else {
      allBills.value = getBillList(currentMonth.value)
    }
  }

  function loadBudget() {
    budget.value = getMonthlyBudget(currentMonth.value === 'all' ? '' : currentMonth.value)
    catBudgets.value = currentMonth.value !== 'all' ? getCategoryBudgets(currentMonth.value) : {}
  }

  function switchMonth(key) {
    currentMonth.value = key
    filterCategory.value = ''
    loadBudget()
    loadBills()
  }

  const filteredBills = computed(() => {
    let list = allBills.value
    if (filterType.value !== -1) {
      list = list.filter(b => {
        const bType = (b.type === 'income' || b.type === 1) ? 1 : 0
        return bType === filterType.value
      })
    }
    if (filterCategory.value) {
      list = list.filter(b => b.category === filterCategory.value)
    }
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase()
      list = list.filter(b =>
        (b.note || b.remark || '').toLowerCase().includes(kw) ||
        (b.category || '').toLowerCase().includes(kw)
      )
    }
    return list
  })

  const stats = computed(() => {
    let income = 0, expense = 0
    allBills.value.forEach(b => {
      if (b.type === 'income' || b.type === 1) income += b.amount || 0
      else expense += b.amount || 0
    })
    return {
      income, expense,
      balance: income - expense,
      budgetUsed: budget.value > 0 ? Math.round(expense / budget.value * 100) : 0
    }
  })

  const groupedBills = computed(() => {
    const groups = {}
    filteredBills.value.forEach(b => {
      const date = b.bill_date || ''
      if (!groups[date]) groups[date] = []
      groups[date].push(b)
    })
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => {
        const dayExpense = items.filter(b => b.type !== 'income' && b.type !== 1).reduce((s, b) => s + (b.amount || 0), 0)
        const dayIncome = items.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
        return { date, items, dayExpense, dayIncome }
      })
  })

  const hasActiveFilter = computed(() =>
    searchKeyword.value || filterType.value !== -1 || filterCategory.value
  )

  function resetFilters() {
    searchKeyword.value = ''
    filterType.value = -1
    filterCategory.value = ''
  }

  function setFilterType(type) {
    filterType.value = type
    filterCategory.value = ''
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '未知日期'
    const d = new Date(dateStr)
    if (currentMonth.value === 'all') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.round((today - target) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    if (diff === 2) return '前天'
    const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDay}`
  }

  return {
    allBills, currentMonth, filterType, filterCategory, searchKeyword,
    budget, catBudgets, months, currentMonthLabel, currentCategories,
    filteredBills, stats, groupedBills, hasActiveFilter,
    initMonths, loadBills, loadBudget, switchMonth,
    resetFilters, setFilterType, formatDateLabel
  }
}
