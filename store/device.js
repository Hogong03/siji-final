/**
 * 设备 Store — 管理设备标识、注册状态、同步/网络状态
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDeviceId } from '@/utils/device.js'
import { getQueueLength, getLastSyncTime } from '@/utils/sync.js'

export const useDeviceStore = defineStore('device', () => {
  const deviceId = ref('')
  const registered = ref(false)

  // 同步状态
  const syncQueueLength = ref(0)
  const lastSyncTime = ref('')
  const isOnline = ref(true)

  function setDeviceId() {
    deviceId.value = getDeviceId()
  }

  function setRegistered(val) {
    registered.value = val
  }

  function refreshSyncState() {
    syncQueueLength.value = getQueueLength()
    lastSyncTime.value = getLastSyncTime()
  }

  function setSyncQueueLength(len) {
    syncQueueLength.value = len
  }

  function setOnline(val) {
    isOnline.value = val
  }

  return {
    // state
    deviceId, registered,
    syncQueueLength, lastSyncTime, isOnline,
    // actions
    setDeviceId, setRegistered,
    refreshSyncState, setSyncQueueLength, setOnline,
  }
})
