<script setup>
/**
 * 记账编辑页
 * 路由: /pages/bill/edit?id=xxx&month=YYYY-MM  (编辑)
 * 路由: /pages/bill/edit?type=expense&month=YYYY-MM  (新建)
 *
 * 组件：AmountInput（金额输入）, CategoryPicker（分类选择）, DatePicker（日期选择）
 */

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AmountInput from '@/components/bill/AmountInput.vue'
import CategoryPicker from '@/components/bill/CategoryPicker.vue'
import DatePicker from '@/components/bill/DatePicker.vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { getBillList, saveBill, deleteBill } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DANGER_COLOR } from '@/utils/categories.js'

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

/* ---- 类型切换（由 AmountInput 触发） ---- */
function onSwitchType(type) {
  if (billType.value === type) return
  billType.value = type
  category.value = currentCategories.value[0]?.key || ''
}

/* ---- 快捷备注 ---- */
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
  setTimeout(() => uni.navigateBack(), 800)
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
        setTimeout(() => uni.navigateBack(), 800)
      }
    }
  })
}
</script>

<template>
  <view class="edit-page">
    <!-- 金额 + 类型切换 + 数字键盘 -->
    <AmountInput v-model="amount" :type="billType" @update:type="onSwitchType" />

    <!-- 分类选择网格 + 快捷备注 -->
    <CategoryPicker v-model="category" :categories="currentCategories" :quick-notes="quickNotes" @select-quick-note="tapQuickNote" />

    <!-- 详情输入区 -->
    <view class="detail-section">
      <DatePicker v-model="billDate" />
      <view class="detail-row">
        <view class="d-label"><SijiIcon name="edit" size="xs" /><text>备注</text></view>
        <input class="d-input" type="text" v-model="note" placeholder="添加备注..." maxlength="100" />
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

  .d-input {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
    text-align: right;
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

  .ab-text { font-size: $font-md; }
}
</style>
