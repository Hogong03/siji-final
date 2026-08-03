<script setup>
/**
 * 记账编辑页 — 5.0 优化版
 * 路由: /pages/bill/edit?id=xxx&month=YYYY-MM  (编辑)
 * 路由: /pages/bill/edit?type=expense&month=YYYY-MM  (新建)
 */
import { ref, computed } from 'vue'
import { onLoad, onBackPress } from '@dcloudio/uni-app'
import AmountInput from '@/components/bill/AmountInput.vue'
import CategoryPicker from '@/components/bill/CategoryPicker.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { getBillList, saveBill, deleteBill } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DANGER_COLOR } from '@/utils/categories.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

/* ---- 状态 ---- */
const isEdit = ref(false)
const editId = ref('')
const editMonth = ref('')
const billType = ref('expense')
const amount = ref('')
const category = ref('')
const billDate = ref('')
const note = ref('')

const categoryConfig = { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES }
const currentCategories = computed(() => categoryConfig[billType.value] || [])

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

function onSwitchType(type) {
  if (billType.value === type) return
  billType.value = type
  category.value = currentCategories.value[0]?.key || ''
}

function tapQuickNote(qn) {
  note.value = note.value ? `${note.value} ${qn}` : qn
}

/* ---- 生命周期 ---- */
onLoad((query) => {
  const q = query || {}
  const now = new Date()
  billDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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

onBackPress(() => {
  if (amount.value || note.value) {
    uni.showModal({ title: '放弃记账？', content: '当前内容未保存', confirmText: '放弃', cancelText: '继续编辑', success: (res) => { if (res.confirm) safeNavigateBack() } })
    return true
  }
  return false
})

function loadBill() {
  const list = getBillList(editMonth.value)
  const bill = list.find(b => b.client_id === editId.value)
  if (bill) {
    billType.value = (bill.type === 'income' || bill.type === 1) ? 'income' : 'expense'
    amount.value = String(bill.amount || '')
    category.value = bill.category || ''
    billDate.value = bill.bill_date || billDate.value
    note.value = bill.note || bill.remark || ''
  }
}

/* ---- 日期选择 ---- */
const showDatePicker = ref(false)
const datePickerStart = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const datePickerEnd = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const isToday = computed(() => {
  const now = new Date()
  return billDate.value === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

function onDateChange(e) {
  billDate.value = e.detail.value
  showDatePicker.value = false
}

function quickDate(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  billDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  showDatePicker.value = false
}

/* ---- 保存 ---- */
function handleSave() {
  const amt = parseFloat(amount.value)
  if (!amt || amt <= 0) { uni.showToast({ title: '请输入金额', icon: 'none' }); return }
  if (!category.value) { uni.showToast({ title: '请选择分类', icon: 'none' }); return }

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
  setTimeout(() => safeNavigateBack(), 800)
}

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
        setTimeout(() => safeNavigateBack(), 800)
      }
    }
  })
}
</script>

<template>
  <view class="edit-page">
    <!-- 类型切换 + 金额显示 -->
    <view class="type-switch">
      <view class="ts-btn" :class="{ active: billType === 'expense', expense: billType === 'expense' }" @tap="onSwitchType('expense')">支出</view>
      <view class="ts-btn" :class="{ active: billType === 'income', income: billType === 'income' }" @tap="onSwitchType('income')">收入</view>
    </view>
    <view class="amount-display" :class="billType">
      <text class="currency">¥</text>
      <text class="amount-num">{{ amount || '0' }}</text>
    </view>

    <!-- 分类选择 -->
    <CategoryPicker v-model="category" :categories="currentCategories" :quick-notes="quickNotes" @select-quick-note="tapQuickNote" />

    <!-- 日期+备注合并行 -->
    <view class="detail-section">
      <view class="detail-row" @tap="showDatePicker = true">
        <view class="d-label"><SijiIcon name="calendar" size="xs" /><text>日期</text></view>
        <text class="d-value">{{ isToday ? '今天' : billDate }}</text>
        <text class="d-arrow">›</text>
      </view>
      <view class="detail-row">
        <view class="d-label"><SijiIcon name="edit" size="xs" /><text>备注</text></view>
        <input class="d-input" type="text" v-model="note" placeholder="添加备注..." maxlength="100" />
      </view>
    </view>

    <!-- 快捷备注横滑 -->
    <scroll-view class="quick-notes-scroll" scroll-x v-if="quickNotes.length > 0">
      <view class="qn-list">
        <view v-for="qn in quickNotes" :key="qn" class="qn-tag" @tap="tapQuickNote(qn)">{{ qn }}</view>
      </view>
    </scroll-view>

    <!-- 数字键盘 -->
    <view class="num-pad">
      <view v-for="key in ['1','2','3','4','5','6','7','8','9','.','0','del']" :key="key"
        class="np-key" :class="{ 'np-del': key === 'del' }"
        @tap="key === 'del' ? amount = amount.slice(0, -1) : (key === '.' && amount.includes('.') ? null : (amount.includes('.') && (amount.split('.')[1]||'').length >= 2 ? null : (amount === '0' && key !== '.' ? amount = key : amount += key)))">
        <text v-if="key !== 'del'" class="np-text">{{ key }}</text>
        <text v-else class="np-icon">⌫</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-bar">
      <view v-if="isEdit" class="action-btn delete" @tap="handleDelete"><text class="ab-text">删除</text></view>
      <view class="action-btn save" @tap="handleSave"><text class="ab-text">{{ isEdit ? '更新' : '保存' }}</text></view>
    </view>

    <!-- 日期选择面板 -->
    <view class="dp-mask" v-if="showDatePicker" @tap="showDatePicker = false">
      <view class="dp-content" @tap.stop>
        <text class="dp-title">选择日期</text>
        <view class="dp-quick-row">
          <view class="dp-quick" @tap="quickDate(0)">今天</view>
          <view class="dp-quick" @tap="quickDate(1)">昨天</view>
          <view class="dp-quick" @tap="quickDate(2)">前天</view>
        </view>
        <picker mode="date" :value="billDate" :start="datePickerStart" :end="datePickerEnd" @change="onDateChange">
          <view class="dp-pick-trigger"><text class="dp-pick-text">{{ billDate }} ›</text></view>
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
  background: #F4F4F5;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 类型切换 */
.type-switch {
  display: flex;
  margin: 16rpx 20rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 4rpx;

  .ts-btn {
    flex: 1;
    text-align: center;
    padding: 14rpx 0;
    border-radius: 32rpx;
    font-size: 28rpx;
    font-weight: 600;
    color: #71717A;
    transition: all 0.15s ease;

    &.active {
      color: #FFFFFF;
      &.expense { background: #18181B; }
      &.income { background: #3F3F46; }
    }
  }
}

/* 金额显示 */
.amount-display {
  text-align: center;
  padding: 12rpx 0;

  .currency { font-size: 36rpx; font-weight: 600; vertical-align: top; }
  .amount-num { font-size: 72rpx; font-weight: 800; letter-spacing: 2rpx; }

  &.expense .currency, &.expense .amount-num { color: #18181B; }
  &.income .currency, &.income .amount-num { color: #52525B; }
}

/* 详情区 */
.detail-section {
  margin: 0 20rpx 8rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  border-bottom: 1rpx solid #E4E4E7;
  &:last-child { border-bottom: none; }

  .d-label {
    font-size: 24rpx;
    color: #71717A;
    width: 100rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4rpx;
  }

  .d-value {
    flex: 1;
    font-size: 24rpx;
    color: #18181B;
    font-weight: 600;
    text-align: right;
  }

  .d-input {
    flex: 1;
    font-size: 24rpx;
    color: #18181B;
    text-align: right;
  }

  .d-arrow {
    font-size: 28rpx;
    color: #A1A1AA;
    margin-left: 8rpx;
  }
}

/* 快捷备注横滑 */
.quick-notes-scroll {
  white-space: nowrap;
  padding: 0 20rpx;
  margin-bottom: 8rpx;
}

.qn-list {
  display: inline-flex;
  gap: 8rpx;
}

.qn-tag {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: #71717A;
  white-space: nowrap;
  &:active { background: #E4E4E7; }
}

/* 数字键盘 */
.num-pad {
  display: flex;
  flex-wrap: wrap;
  padding: 4rpx 16rpx;
  margin-top: auto;
}

.np-key {
  width: calc(33.33% - 6rpx);
  margin: 3rpx;
  padding: 18rpx 0;
  background: #FFFFFF;
  border-radius: 12rpx;
  text-align: center;
  transition: background 0.1s ease;

  &:active { background: #E4E4E7; }
  &.np-del { background: rgba(0, 0, 0, 0.04); }

  .np-text { font-size: 36rpx; font-weight: 600; color: #18181B; }
  .np-icon { font-size: 36rpx; color: #71717A; }
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 20rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  transition: transform 0.1s ease;

  &:active { transform: scale(0.97); }

  &.save { background: #18181B; color: #FFFFFF; }
  &.delete { flex: 0 0 140rpx; background: rgba(239, 68, 68, 0.1); color: #EF4444; }

  .ab-text { font-size: 28rpx; }
}

/* 日期面板 */
.dp-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.dp-content {
  width: 100%;
  background: #FFFFFF;
  border-top-left-radius: 16rpx;
  border-top-right-radius: 16rpx;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.dp-title { font-size: 28rpx; font-weight: 700; color: #18181B; display: block; text-align: center; margin-bottom: 16rpx; }

.dp-quick-row { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.dp-quick {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  background: #F4F4F5;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #52525B;
  &:active { background: #E4E4E7; }
}

.dp-pick-trigger { display: flex; justify-content: center; padding: 12rpx 0; margin-bottom: 12rpx; }
.dp-pick-text { font-size: 28rpx; font-weight: 600; color: #18181B; }

.dp-actions { display: flex; gap: 12rpx; }
.dp-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  &.cancel { background: #F4F4F5; color: #71717A; }
  &.confirm { background: #18181B; color: #FFFFFF; }
}

@media (prefers-color-scheme: dark) {
  .edit-page { background: #18181B; }
  .type-switch { background: #27272A; }
  .ts-btn { color: #A1A1AA; &.active { color: #18181B; &.expense { background: #FAFAFA; } &.income { background: #A1A1AA; } } }
  .amount-display { &.expense .currency, &.expense .amount-num { color: #FAFAFA; } &.income .currency, &.income .amount-num { color: #D4D4D8; } }
  .detail-section { background: #27272A; }
  .detail-row { border-bottom-color: #3F3F46; }
  .d-label { color: #71717A; }
  .d-value { color: #FAFAFA; }
  .d-input { color: #FAFAFA; }
  .d-arrow { color: #71717A; }
  .qn-tag { background: #27272A; color: #A1A1AA; &:active { background: #3F3F46; } }
  .np-key { background: #27272A; &:active { background: #3F3F46; } &.np-del { background: #3F3F46; } }
  .np-text { color: #FAFAFA; }
  .np-icon { color: #71717A; }
  .action-btn { &.save { background: #FAFAFA; color: #18181B; } &.delete { background: rgba(239, 68, 68, 0.15); } }
  .dp-content { background: #27272A; }
  .dp-title { color: #FAFAFA; }
  .dp-quick { background: #3F3F46; color: #D4D4D8; &:active { background: #52525B; } }
  .dp-pick-text { color: #FAFAFA; }
  .dp-btn { &.cancel { background: #3F3F46; color: #71717A; } &.confirm { background: #FAFAFA; color: #18181B; } }
}
</style>
