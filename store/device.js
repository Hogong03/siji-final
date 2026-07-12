/**
 * 设备 Store — 管理设备标识、网络状态
 * 同步功能已移除
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDeviceId } from '@/utils/device.js'

export const useDeviceStore = defineStore('device', () => {
  const deviceId = ref('')
  const registered = ref(false)
  const isOnline = ref(true)

  function setDeviceId() {
    deviceId.value = getDeviceId()
  }

  function setRegistered(val) {
    registered.value = val
  }

  function setOnline(val) {
    isOnline.value = val
  }

  return {
    // state
    deviceId, registered, isOnline,
    // actions
    setDeviceId, setRegistered, setOnline,
  }
})
