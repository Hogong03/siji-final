<script setup>
/**
 * TemplateForm - 模板创建/编辑表单弹窗
 *
 * Props:
 *   visible   - 是否显示弹窗
 *   isEdit    - 是否为编辑模式（预留）
 *   editData  - 编辑时的初始数据（预留）
 *
 * Emits:
 *   close - 关闭弹窗
 *   save  - 保存模板，携带表单数据 { name, icon, color, description, priority, subtasks[] }
 */

import { ref, watch } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  editData: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save'])

const iconOptions = ['📋', '🏃', '📚', '✈️', '🎓', '🌅', '💼', '💰', '🏠', '🎮', '✨', '🎯']
const colorOptions = ['#000000', '#10B981', '#E8A838', '#D35D5D', '#F5A623', '#3F3F46']
const priorityOptions = [
  { label: '普通', value: 0, color: '#999' },
  { label: '重要', value: 1, color: '#E8A838' },
  { label: '紧急', value: 2, color: '#D35D5D' }
]

const form = ref({
  name: '',
  icon: '📋',
  color: '#000000',
  description: '',
  priority: 2,
  subtasks: ['']
})

// 弹窗打开时重置/填充表单
watch(() => props.visible, (val) => {
  if (val) {
    if (props.isEdit && props.editData) {
      const d = props.editData
      const subtasks = (d.plan_data?.subtasks || []).map(s => typeof s === 'string' ? s : (s.title || ''))
      form.value = {
        name: d.name || '',
        icon: d.icon || '📋',
        color: d.color || '#000000',
        description: d.description || '',
        priority: d.plan_data?.priority ?? 2,
        subtasks: subtasks.length > 0 ? subtasks : ['']
      }
    } else {
      form.value = { name: '', icon: '📋', color: '#000000', description: '', priority: 2, subtasks: [''] }
    }
  }
})

function addSubtask() {
  form.value.subtasks.push('')
}

function removeSubtask(idx) {
  if (form.value.subtasks.length > 1) {
    form.value.subtasks.splice(idx, 1)
  }
}

function handleClose() {
  emit('close')
}

function handleSave() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入模板名称', icon: 'none' })
    return
  }
  const subtasks = form.value.subtasks
    .map(s => s.trim())
    .filter(s => s)

  if (subtasks.length === 0) {
    uni.showToast({ title: '至少添加一个子任务', icon: 'none' })
    return
  }

  emit('save', {
    name: form.value.name.trim(),
    icon: form.value.icon,
    color: form.value.color,
    description: form.value.description.trim(),
    priority: form.value.priority,
    subtasks
  })
}
</script>

<template>
  <view v-if="visible" class="modal-mask" @tap="handleClose">
    <view class="modal-content" @tap.stop>
      <view class="modal-header">
        <view class="modal-title"><SijiIcon name="edit" size="sm" /><text>自定义模板</text></view>
        <text class="modal-close" @tap="handleClose">✕</text>
      </view>

      <scroll-view class="custom-scroll" scroll-y>
        <!-- 名称 -->
        <view class="form-section">
          <text class="form-label">模板名称</text>
          <input v-model="form.name" class="form-input" placeholder="如：晨间惯例" maxlength="12" />
        </view>

        <!-- 图标 -->
        <view class="form-section">
          <text class="form-label">图标</text>
          <view class="icon-row">
            <view
              v-for="icon in iconOptions" :key="icon"
              class="icon-pick"
              :class="{ active: form.icon === icon }"
              @tap="form.icon = icon"
            >{{ icon }}</view>
          </view>
        </view>

        <!-- 颜色 -->
        <view class="form-section">
          <text class="form-label">颜色</text>
          <view class="color-row">
            <view
              v-for="c in colorOptions" :key="c"
              class="color-pick"
              :class="{ active: form.color === c }"
              :style="{ background: c }"
              @tap="form.color = c"
            />
          </view>
        </view>

        <!-- 描述 -->
        <view class="form-section">
          <text class="form-label">描述</text>
          <input v-model="form.description" class="form-input" placeholder="模板简介" maxlength="40" />
        </view>

        <!-- 优先级 -->
        <view class="form-section">
          <text class="form-label">默认优先级</text>
          <view class="prio-row">
            <view
              v-for="p in priorityOptions" :key="p.value"
              class="prio-pick"
              :class="{ active: form.priority === p.value }"
              :style="form.priority === p.value ? { background: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }"
              @tap="form.priority = p.value"
            >{{ p.label }}</view>
          </view>
        </view>

        <!-- 子任务 -->
        <view class="form-section">
          <text class="form-label">子任务</text>
          <view
            v-for="(s, i) in form.subtasks" :key="i"
            class="subtask-input-row"
          >
            <text class="si-num">{{ i + 1 }}</text>
            <input
              v-model="form.subtasks[i]"
              class="si-input"
              :placeholder="`子任务 ${i + 1}`"
              maxlength="30"
            />
            <text
              v-if="form.subtasks.length > 1"
              class="si-del"
              @tap="removeSubtask(i)"
            >✕</text>
          </view>
          <view class="add-subtask" @tap="addSubtask">+ 添加子任务</view>
        </view>

        <view style="height: 120rpx" />
      </scroll-view>

      <view class="modal-footer">
        <view class="mf-btn save" @tap="handleSave">保存模板</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/* 弹窗通用 */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.modal-content {
  width: 100%;
  max-height: 85vh;
  background: $bg-card;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.modal-title { font-size: $font-lg; font-weight: 700; }
.modal-close { font-size: 32rpx; color: $text-hint; padding: 8rpx; }

/* 自定义表单 */
.custom-scroll {
  flex: 1;
  padding: $spacing-md;
  max-height: 60vh;
}

.form-section { margin-bottom: $spacing-md; }

.form-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.form-input {
  font-size: $font-md;
  padding: 16rpx $spacing-sm;
  background: $bg-input;
  border-radius: $radius-sm;
  width: 100%;
}

.icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.icon-pick {
  width: 64rpx; height: 64rpx;
  text-align: center;
  line-height: 64rpx;
  font-size: 32rpx;
  border-radius: $radius-sm;
  background: $bg-btn-secondary;

  &.active { background: $accent; }
}

.color-row {
  display: flex;
  gap: $spacing-sm;
}

.color-pick {
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;

  &.active { border-color: $text-primary; }
}

.prio-row {
  display: flex;
  gap: $spacing-sm;
}

.prio-pick {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: $radius-sm;
  font-size: $font-sm;
  border: 2rpx solid;
  transition: all $transition-fast;
}

.subtask-input-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.si-num {
  width: 36rpx; height: 36rpx;
  border-radius: 50%;
  background: $bg-btn-secondary;
  font-size: $font-xs;
  color: $text-secondary;
  text-align: center;
  line-height: 36rpx;
  flex-shrink: 0;
}

.si-input {
  flex: 1;
  font-size: $font-sm;
  padding: 12rpx $spacing-sm;
  background: $bg-input;
  border-radius: $radius-sm;
}

.si-del { font-size: 24rpx; color: $danger; padding: 8rpx; }

.add-subtask {
  font-size: $font-sm;
  color: $accent;
  padding: 12rpx 0;
  text-align: center;
  border: 2rpx dashed rgba(0, 0, 0, 0.1);
  border-radius: $radius-sm;
}

.modal-footer {
  padding: $spacing-md;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
}

.mf-btn.save {
  text-align: center;
  padding: 24rpx 0;
  background: $accent;
  color: #FFFFFF;
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 600;
}

</style>
