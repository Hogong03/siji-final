/**
 * 计划卡片左滑手势 — 完成 / 编辑 / 删除
 */
import { ref } from 'vue'

const ACTION_WIDTH = 210 // 三个按钮：完成70+编辑70+删除70

export function usePlanSwipe(onComplete, onEdit, onDelete) {
  const swipeItem = ref(null)
  const swipeStartX = ref(0)
  const swipeStartId = ref('')
  const swipeMoveX = ref(0)
  const swipingId = ref('')

  function onTouchStart(e, plan) {
    swipeStartX.value = e.touches[0].clientX
    swipeStartId.value = plan.client_id
    if (swipeItem.value && swipeItem.value !== plan.client_id) swipeItem.value = null
  }

  function onTouchMove(e, plan) {
    if (swipeStartId.value !== plan.client_id) return
    const dx = e.touches[0].clientX - swipeStartX.value
    if (dx < 0) {
      swipingId.value = plan.client_id
      swipeMoveX.value = Math.max(-ACTION_WIDTH, dx)
    }
  }

  function onTouchEnd(plan) {
    if (swipingId.value !== plan.client_id) return
    if (swipeMoveX.value < -ACTION_WIDTH / 2) swipeItem.value = plan.client_id
    else swipeItem.value = null
    swipingId.value = ''
    swipeMoveX.value = 0
  }

  function getSwipeOffset(plan) {
    if (swipingId.value === plan.client_id) return swipeMoveX.value + 'px'
    if (swipeItem.value === plan.client_id) return -ACTION_WIDTH + 'px'
    return '0px'
  }

  function closeSwipe() {
    swipeItem.value = null
  }

  function handleTap(plan, onTap) {
    if (swipeItem.value) { closeSwipe(); return }
    onTap?.(plan)
  }

  function handleComplete(plan) {
    closeSwipe()
    onComplete?.(plan)
  }

  function handleEdit(plan) {
    closeSwipe()
    onEdit?.(plan)
  }

  function handleDelete(plan) {
    uni.showModal({
      title: '删除计划',
      content: `确认删除「${plan.title}」？`,
      confirmColor: '#D35D5D',
      success: (res) => {
        if (res.confirm) {
          uni.vibrateShort({ type: 'light' })
          onDelete?.(plan)
          swipeItem.value = null
        }
      }
    })
  }

  return {
    swipeItem,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getSwipeOffset,
    closeSwipe,
    handleTap,
    handleComplete,
    handleEdit,
    handleDelete
  }
}
