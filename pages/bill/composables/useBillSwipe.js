/**
 * 账单左滑删除手势
 * 返回手势状态和事件处理函数
 */
import { ref } from 'vue'

const ACTION_WIDTH = 140

export function useBillSwipe(onDelete) {
  const swipeItem = ref(null)
  const swipeStartX = ref(0)
  const swipeStartId = ref('')
  const swipeMoveX = ref(0)
  const swipingId = ref('')

  function onTouchStart(e, bill) {
    swipeStartX.value = e.touches[0].clientX
    swipeStartId.value = bill.client_id
    if (swipeItem.value && swipeItem.value !== bill.client_id) swipeItem.value = null
  }

  function onTouchMove(e, bill) {
    if (swipeStartId.value !== bill.client_id) return
    const dx = e.touches[0].clientX - swipeStartX.value
    if (dx < 0) {
      swipingId.value = bill.client_id
      swipeMoveX.value = Math.max(-ACTION_WIDTH, dx)
    }
  }

  function onTouchEnd(bill) {
    if (swipingId.value !== bill.client_id) return
    if (swipeMoveX.value < -ACTION_WIDTH / 2) swipeItem.value = bill.client_id
    else swipeItem.value = null
    swipingId.value = ''
    swipeMoveX.value = 0
  }

  function getSwipeOffset(bill) {
    if (swipingId.value === bill.client_id) return swipeMoveX.value + 'px'
    if (swipeItem.value === bill.client_id) return -ACTION_WIDTH + 'px'
    return '0px'
  }

  function closeSwipe() {
    swipeItem.value = null
  }

  function handleTap(bill, onTap) {
    if (swipeItem.value) { closeSwipe(); return }
    onTap?.(bill)
  }

  function confirmDelete(bill) {
    uni.showModal({
      title: '删除账单',
      content: `确认删除 ${bill.category} ¥${bill.amount.toFixed(2)}？`,
      confirmColor: '#D35D5D',
      success: (res) => {
        if (res.confirm) {
          uni.vibrateShort({ type: 'light' })
          onDelete?.(bill)
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
    confirmDelete
  }
}
