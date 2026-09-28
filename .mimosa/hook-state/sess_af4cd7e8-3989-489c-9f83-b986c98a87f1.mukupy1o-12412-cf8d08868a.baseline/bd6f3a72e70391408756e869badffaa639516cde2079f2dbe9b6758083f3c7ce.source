/**
 * 标签条：折叠 + 自定义顺序（4.4.0）
 *
 * 需求原话：「记录管理中初始只需要有一个全部按钮，点击全部按钮过后展开所有的标签，
 * 并且所有的标签位置都需要可以移动」。
 * 移动后的顺序必须落盘，否则每次按频次重排都会把用户调好的顺序冲掉。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import './setup.js'
import {
  TAG_ORDER_KEY,
  getTagOrder,
  setTagOrder,
  applyTagOrder,
  moveTagInList
} from '../utils/storage/tags.js'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const tag = (name, count = 1) => ({ name, count })

describe('applyTagOrder：用户顺序优先，新标签排后面', () => {
  const list = [tag('工作', 9), tag('生活', 5), tag('复习资料', 1)]

  it('按 order 重排', () => {
    expect(applyTagOrder(list, ['复习资料', '工作']).map(t => t.name))
      .toEqual(['复习资料', '工作', '生活'])
  })

  it('不在 order 里的标签保持在后面（相对顺序不变）', () => {
    expect(applyTagOrder(list, ['生活']).map(t => t.name))
      .toEqual(['生活', '工作', '复习资料'])
  })

  it('order 为空 → 原样返回（不改变原有的按频次排序）', () => {
    expect(applyTagOrder(list, []).map(t => t.name)).toEqual(['工作', '生活', '复习资料'])
    expect(applyTagOrder(list, null).map(t => t.name)).toEqual(['工作', '生活', '复习资料'])
  })

  it('order 里有已删除的标签名 → 忽略，不报错', () => {
    expect(applyTagOrder(list, ['不存在的标签', '工作']).map(t => t.name))
      .toEqual(['工作', '生活', '复习资料'])
  })

  it('order 有重复名 → 只认第一个位置', () => {
    expect(applyTagOrder(list, ['生活', '工作', '生活']).map(t => t.name))
      .toEqual(['生活', '工作', '复习资料'])
  })
})

describe('moveTagInList：左右挪一位', () => {
  const order = ['a', 'b', 'c']

  it('右移：和下一位置换', () => {
    expect(moveTagInList(order, 'a', 1)).toEqual(['b', 'a', 'c'])
  })

  it('左移：和上一位置换', () => {
    expect(moveTagInList(order, 'c', -1)).toEqual(['a', 'c', 'b'])
  })

  it('已经在最左还左移 → 原样返回', () => {
    expect(moveTagInList(order, 'a', -1)).toEqual(['a', 'b', 'c'])
  })

  it('已经在最右还右移 → 原样返回', () => {
    expect(moveTagInList(order, 'c', 1)).toEqual(['a', 'b', 'c'])
  })

  it('标签不存在 → 原样返回', () => {
    expect(moveTagInList(order, 'zzz', 1)).toEqual(['a', 'b', 'c'])
  })

  it('不修改传入的数组（纯函数）', () => {
    const input = ['a', 'b']
    moveTagInList(input, 'a', 1)
    expect(input).toEqual(['a', 'b'])
  })
})

describe('顺序落盘：getTagOrder / setTagOrder', () => {
  beforeEach(() => {
    uni.removeStorageSync(TAG_ORDER_KEY)
  })

  it('没存过 → 空数组', () => {
    expect(getTagOrder('diary')).toEqual([])
  })

  it('存了能读回来', () => {
    setTagOrder('diary', ['工作', '生活'])
    expect(getTagOrder('diary')).toEqual(['工作', '生活'])
  })

  it('按类型分片：记录的顺序不影响计划', () => {
    setTagOrder('diary', ['工作'])
    setTagOrder('plan', ['复习'])
    expect(getTagOrder('diary')).toEqual(['工作'])
    expect(getTagOrder('plan')).toEqual(['复习'])
  })

  it('存脏数据（非字符串）会被滤掉', () => {
    setTagOrder('diary', ['工作', '', null, 123, '生活'])
    expect(getTagOrder('diary')).toEqual(['工作', '生活'])
  })

  it('存储里是坏 JSON → 空数组，不抛错', () => {
    uni.setStorageSync(TAG_ORDER_KEY, '{不是JSON')
    expect(getTagOrder('diary')).toEqual([])
  })
})

describe('静态接线：折叠与排序都接上了', () => {
  it('列表页：默认只露「全部」，点开才铺开，且带排序开关', () => {
    const vue = read('pages/diary/list.vue')
    expect(vue).toContain('@tap="tapAll"')
    expect(vue).toContain('v-if="showAllTags"')
    expect(vue).toContain('@tap="toggleSortMode"')
    expect(vue).toContain('moveTag(t.name, -1)')
    expect(vue).toContain('moveTag(t.name, 1)')
  })

  it('组合式函数：导出折叠与排序接口，且 quickTags 走自定义顺序', () => {
    const js = read('composables/useDiaryList.js')
    expect(js).toContain('showAllTags, sortMode, canMove, tapAll, toggleSortMode, moveTag')
    expect(js).toContain('applyTagOrder(byCount, tagOrder.value)')
    expect(js).toContain("setTagOrder('diary', next)")
  })
})
