<script setup>
/**
 * 记账编辑页
 * 路由: /pages/bill/edit?id=xxx&month=YYYY-MM  (编辑)
 * 路由: /pages/bill/edit?type=expense&month=YYYY-MM  (新建)
 * 
 * 功能：
 *  ① 支出/收入切换
 *  ② 金额输入（大数字键盘风格）
 *  ③ 分类选择网格
 *  ④ 日期选择
 *  ⑤ 备注输入
 *  ⑥ 快捷备注标签
 *  ⑦ 保存/删除
 */

import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { getBillList, saveBill, deleteBill } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DANGER_COLOR } from '@/utils/categories.js'

// ==================== 状态 ====================

const isEdit = ref(false)
const editId = ref('')
const editMonth = ref('')
const billType = ref('expense') // expense | income
const amount = ref('')
const category = ref('')
const billDate = ref('')
const note = ref('')
const showDatePicker = ref(false)

// 分类配置（统一从 utils/categories.js 引入）
const categoryConfig = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES
}

const currentCategories = computed(() => categoryConfig[billType.value] || [])

// 快捷备注
const quickNotes = computed(() => {
  const map = {
    '餐饮': ['早餐', '午餐', '晚餐', '夜宵', '外卖', '聚餐'],
    '咖啡奶茶': ['咖啡', '奶茶', '果汁', '下午茶'],
    '交通出行': ['地铁', '公交', '打车', '停车', '加油', '高铁'],
    '网购购物': ['日用品', '衣服', '电子产品', '家居'],
    '居住水电': ['房租', '水费', '电费', '燃气费', '物业费'],
    '通讯网络': ['话费', '宽带', '流量包'],
    '娱乐休闲': ['电影', '游戏', 'KTV', '旅游'],
    '运动健身': ['健身房', '跑步', '游泳', '瑜伽'],
    '医疗健康': ['门诊', '药品', '体检', '牙科'],
    '教育学习': ['书籍', '课程', '培训', '考试'],
    '人情社交': ['红包', '礼物', '请客', '份子钱'],
    '工资薪资': ['月薪', '奖金', '年终奖'],
    '兼职外快': ['兼职', '稿费', '咨询费'],
    '投资理财': ['利息', '股息', '基金收益', '理财收益']
  }
  return map[category.value] || []
})

// ==================== 生命周期 ====================
onLoad((query) => {
  const q = query || {}
  const now = new Date()
  billDate.value = formatDateStr(now)

  if (q.id && q.id !== 'new') {
    isEdit.value = true
    editId.value = q.id
    editMonth.value = q.month || ''
    loadBill()
  } else {
    billType.value = q.type === 'income' ? 'income' : 'expense'
    category.value = currentCategories.value[0]?.key || ''
  }
})

function loadBill() {
  const list = getBillList(editMonth.value)
  const bill = list.find(b => b.client_id === editId.value)
  if (bill) {
    billType.value = (bill.type === 'income' || bill.type === 1) ? 'income' : 'expense'
    amount.value = String(bill.amount || '')
    category.value = bill.category || ''
    billDate.value = bill.bill_date || formatDateStr(new Date())
    note.value = bill.note || bill.remark || ''
  }
}

// ==================== 交互 ====================
function switchType(type) {
  if (billType.value === type) return
  billType.value = type
  category.value = currentCategories.value[0]?.key || ''
}

function selectCategory(cat) {
  category.value = cat
}

function tapQuickNote(qn) {
  note.value = note.value ? `${note.value} ${qn}` : qn
}

// 日期选择
function onDateChange(e) {
  billDate.value = e.detail.value
}

// 数字键盘输入
function tapNumber(num) {
  // 防止多个小数点
  if (num === '.' && amount.value.includes('.')) return
  // 小数点后最多两位
  if (amount.value.includes('.') && amount.value.split('.')[1]?.length >= 2) return
  // 首位不能为 0（除非小数）
  if (amount.value === '0' && num !== '.') {
    amount.value = num
    return
  }
  amount.value += num
}

function tapDelete() {
  amount.value = amount.value.slice(0, -1)
}

function tapClear() {
  amount.value = ''
}

// ==================== 保存 ====================
function handleSave() {
  const amt = parseFloat(amount.value)
  if (!amt || amt <= 0) {
    uni.showToast({ title: '请输入金额', icon: 'none' })
    return
  }
  if (!category.value) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    return
  }

  const now = Date.now()
  const bill = {
    client_id: isEdit.value ? editId.value : generateEntityId('bill'),
    type: billType.value,
    amount: amt,
    category: category.value,
    note: note.value,
    bill_date: billDate.value,
    created_at: isEdit.value ? (getOriginalCreatedAt() || now) : now,
    updated_at: now,
    is_deleted: 0
  }

  saveBill(bill)
  uni.showToast({ title: isEdit.value ? '已更新' : '已保存', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 800)
}

// 编辑时获取原始 created_at
function getOriginalCreatedAt() {
  const list = getBillList(editMonth.value)
  const bill = list.find(b => b.client_id === editId.value)
  return bill?.created_at || Date.now()
}

function handleDelete() {
  if (!isEdit.value) return
  uni.showModal({
    title: '删除账单',
    content: '确认删除这条账单？删除后不可恢复。',
    confirmColor: DANGER_COLOR,
    success: (res) => {
      if (res.confirm) {
        deleteBill(editId.value, editMonth.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 800)
      }
    }
  })
}

// ==================== 格式化 ====================
function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDateStr(d)
}

function getDayBefore(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDateStr(d)
}

// 显示金额格式化
const displayAmount = computed(() => {
  if (!amount.value) return '0'
  return amount.value
})

const today = computed(() => formatDateStr(new Date()))
const datePickerStart = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return formatDateStr(d)
})
const datePickerEnd = computed(() => formatDateStr(new Date()))

// 数字键盘
const numPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']
</script>

<template>
  <view class="edit-page">
    <!-- 类型切换 -->
    <view class="type-switch">
      <view
        class="ts-btn" :class="{ active: billType === 'expense', expense: billType === 'expense' }"
        @tap="switchType('expense')"
      >支出</view>
      <view
        class="ts-btn" :class="{ active: billType === 'income', income: billType === 'income' }"
        @tap="switchType('income')"
      >收入</view>
    </view>

    <!-- 金额显示 -->
    <view class="amount-display" :class="billType">
      <text class="currency">¥</text>
      <text class="amount-num">{{ displayAmount }}</text>
    </view>

    <!-- 分类选择网格 -->
    <view class="category-grid">
      <view
        v-for="cat in currentCategories" :key="cat.key"
        class="cat-cell" :class="{ selected: category === cat.key }"
        @tap="selectCategory(cat.key)"
      >
        <view class="cat-icon-wrap" :style="{ background: category === cat.key ? cat.color : cat.color + '12' }">
          <text class="cat-icon">{{ cat.icon }}</text>
        </view>
        <text class="cat-name" :class="{ selected: category === cat.key }" :style="{ color: category === cat.key ? cat.color : '' }">{{ cat.key }}</text>
      </view>
    </view>

    <!-- 快捷备注 -->
    <view class="quick-notes" v-if="quickNotes.length > 0">
      <view
        v-for="qn in quickNotes" :key="qn"
        class="qn-tag"
        @tap="tapQuickNote(qn)"
      >{{ qn }}</view>
    </view>

    <!-- 详情输入区 -->
    <view class="detail-section">
      <view class="detail-row" @tap="showDatePicker = !showDatePicker">
        <view class="d-label"><SijiIcon name="calendar" size="xs" /><text>日期</text></view>
        <text class="d-value">{{ billDate === today ? '今天' : billDate }}</text>
        <text class="d-arrow">›</text>
      </view>
      <view class="detail-row">
        <view class="d-label"><SijiIcon name="edit" size="xs" /><text>备注</text></view>
        <input
          class="d-input"
          type="text"
          v-model="note"
          placeholder="添加备注..."
          maxlength="100"
        />
      </view>
    </view>

    <!-- 数字键盘 -->
    <view class="num-pad">
      <view
        v-for="key in numPad" :key="key"
        class="np-key" :class="{ 'np-del': key === 'del' }"
        @tap="key === 'del' ? tapDelete() : tapNumber(key)"
      >
        <text v-if="key !== 'del'" class="np-text">{{ key }}</text>
        <text v-else class="np-icon">⌫</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-bar">
      <view v-if="isEdit" class="action-btn delete" @tap="handleDelete">
        <text class="ab-text">删除</text>
      </view>
      <view class="action-btn save" @tap="handleSave">
        <text class="ab-text">{{ isEdit ? '更新' : '保存' }}</text>
      </view>
    </view>

    <!-- 日期选择器（使用 uni-app 原生 picker） -->
    <picker
      mode="date"
      :value="billDate"
      :start="datePickerStart"
      :end="datePickerEnd"
      @change="onDateChange"
      style="display: none;"
    />

    <!-- 自定义日期面板 -->
    <view class="date-picker-mask" v-if="showDatePicker" @tap="showDatePicker = false">
      <view class="date-picker-content" @tap.stop>
        <text class="dp-title">选择日期</text>
        <view class="dp-quick-row">
          <view class="dp-quick" @tap="billDate = today; showDatePicker = false">今天</view>
          <view class="dp-quick" @tap="billDate = getYesterday(); showDatePicker = false">昨天</view>
          <view class="dp-quick" @tap="billDate = getDayBefore(2); showDatePicker = false">前天</view>
        </view>
        <picker
          mode="date"
          :value="billDate"
          :start="datePickerStart"
          :end="datePickerEnd"
          @change="onDateChange"
        >
          <view class="dp-pick-trigger">
            <text class="dp-pick-text">{{ billDate }} ›</text>
          </view>
        </picker>
        <view class="dp-actions">
          <view class="dp-btn cancel" @tap="showDatePicker = false">取消</view>
          <view class="dp-btn confirm" @tap="showDatePicker = false">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.edit-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $bg-page;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 类型切换 */
.type-switch {
  display: flex;
  margin: $spacing-md;
  background: $bg-card;
  border-radius: $radius-round;
  padding: 4rpx;

  .ts-btn {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: $radius-round;
    font-size: $font-md;
    font-weight: 600;
    color: $text-secondary;
    transition: all $transition-fast;

    &.active {
      color: var(--text-on-ai);

      &.expense { background: var(--color-ai); box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12); }
      &.income { background: var(--text-strong); box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08); }
    }
  }
}

/* 金额显示 */
.amount-display {
  text-align: center;
  padding: $spacing-md 0;

  .currency {
    font-size: $font-xl;
    font-weight: 600;
    vertical-align: top;
  }

  .amount-num {
    font-size: 80rpx;
    font-weight: 800;
    letter-spacing: 2rpx;
  }

  &.expense .currency, &.expense .amount-num { color: var(--color-bill); }
  &.income .currency, &.income .amount-num { color: var(--color-plan); }
}

/* 分类网格 */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-sm;
}

.cat-cell {
  width: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xs 0;
  transition: transform $transition-fast;

  &:active { transform: scale(0.92); }

  .cat-icon-wrap {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-fast;
  }

  .cat-icon {
    font-size: 36rpx;
  }

  .cat-name {
    font-size: 18rpx;
    margin-top: 6rpx;
    text-align: center;
    white-space: nowrap;
    color: $text-secondary;

    &.selected {
      font-weight: 600;
    }
  }

  &.selected {
    .cat-icon-wrap {
      transform: scale(1.1);
    }
  }
}

/* 快捷备注 */
.quick-notes {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-sm;

  .qn-tag {
    padding: 8rpx 20rpx;
    background: $bg-card;
    border-radius: $radius-round;
    font-size: $font-xs;
    color: $text-secondary;

    &:active { background: $bg-input; }
  }
}

/* 详情区 */
.detail-section {
  margin: 0 $spacing-md $spacing-sm;
  background: $bg-card;
  border-radius: $radius-md;
  overflow: hidden;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);

  &:last-child { border-bottom: none; }

  .d-label {
    font-size: $font-sm;
    color: $text-secondary;
    width: 120rpx;
    flex-shrink: 0;
  }

  .d-value {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
    font-weight: 600;
    text-align: right;
  }

  .d-input {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
    text-align: right;
  }

  .d-arrow {
    font-size: $font-md;
    color: $text-hint;
    margin-left: $spacing-xs;
  }
}

/* 数字键盘 */
.num-pad {
  display: flex;
  flex-wrap: wrap;
  padding: $spacing-xs $spacing-md;
  margin-top: auto;
}

.np-key {
  width: calc(33.33% - 6rpx);
  margin: 3rpx;
  padding: 24rpx 0;
  background: $bg-card;
  border-radius: $radius-md;
  text-align: center;
  transition: background $transition-fast;

  &:active { background: $bg-input; }

  &.np-del {
    background: rgba(0, 0, 0, 0.04);
  }

  .np-text {
    font-size: $font-xl;
    font-weight: 600;
    color: $text-primary;
  }

  .np-icon {
    font-size: $font-xl;
    color: $text-secondary;
  }
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 700;
  transition: transform $transition-fast;

  &:active { transform: scale(0.97); }

  &.save {
    background: var(--color-ai);
    color: var(--text-on-ai);
    box-shadow: 0 4rpx 16rpx rgba(99, 102, 241, 0.25);
  }

  &.delete {
    flex: 0 0 160rpx;
    background: rgba(211, 93, 93, 0.1);
    color: $danger;
  }

  .ab-text {
    font-size: $font-md;
  }
}

/* 日期选择器 */
.date-picker-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.date-picker-content {
  width: 100%;
  background: $bg-card;
  border-top-left-radius: $radius-lg;
  border-top-right-radius: $radius-lg;
  padding: $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
}

.dp-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
  display: block;
  text-align: center;
  margin-bottom: $spacing-sm;
}

.dp-quick-row {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.dp-quick {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  background: $bg-input;
  border-radius: $radius-md;
  font-size: $font-sm;
  color: $text-secondary;

  &:active { background: rgba(0, 0, 0, 0.06); }
}

.dp-pick-trigger {
  display: flex;
  justify-content: center;
  padding: $spacing-sm 0;
  margin-bottom: $spacing-sm;
}

.dp-pick-text {
  font-size: $font-md;
  font-weight: 600;
  color: var(--color-ai);
}

.dp-actions {
  display: flex;
  gap: $spacing-sm;

  .dp-btn {
    flex: 1;
    text-align: center;
    padding: 20rpx 0;
    border-radius: $radius-md;
    font-size: $font-md;
    font-weight: 600;

    &.cancel {
      background: $bg-input;
      color: $text-secondary;
    }

    &.confirm {
      background: var(--color-ai);
      color: var(--text-on-ai);
    }
  }
}
</style>
