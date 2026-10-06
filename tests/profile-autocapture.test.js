/**
 * test: TC-004 自报姓名确定性兜底捕捉 —— utils/profile-autocapture.js
 *
 * 真实故障（2026-10-07）：用户说"我叫测试员"，模型当轮只口头答应没调 smart_update_profile，
 * 画像里没有 → 几轮后问"我叫什么"答不上。本模块提供确定性提取（宁可漏捉不可错存），
 * useChatEngine 在 AI 回复落定后静默补落库。
 */
import { describe, it, expect } from 'vitest'
import { extractSelfName, shouldAutoCapture } from '../utils/profile-autocapture.js'

describe('extractSelfName — 自报姓名提取', () => {
  it('三种高置信度句式', () => {
    expect(extractSelfName('我叫测试员')).toBe('测试员')
    expect(extractSelfName('我的名字是小明')).toBe('小明')
    expect(extractSelfName('我的名字叫小明')).toBe('小明')
    expect(extractSelfName('叫我老王')).toBe('老王')
  })

  it('疑问句不捕捉', () => {
    expect(extractSelfName('我叫什么？')).toBe('')
    expect(extractSelfName('你猜我叫什么名字')).toBe('')
  })

  it('非自报句式不捕捉', () => {
    expect(extractSelfName('测试一下')).toBe('')
    expect(extractSelfName('今天天气不错')).toBe('')
    expect(extractSelfName('帮我记个账，午饭 30 元')).toBe('')
  })

  it('含疑问词/助词的名字不捕捉（我叫了外卖）', () => {
    expect(extractSelfName('我叫了外卖')).toBe('')
    expect(extractSelfName('我叫了吗')).toBe('')
  })

  it('占位符名字不捕捉', () => {
    expect(extractSelfName('我叫abc')).toBe('')
    expect(extractSelfName('我叫xxx')).toBe('')
    expect(extractSelfName('我叫某某某')).toBe('')
    expect(extractSelfName('我叫测试一下')).toBe('')
  })

  it('单个字不捕捉（太短不可信）', () => {
    expect(extractSelfName('我叫王')).toBe('')
  })

  it('空串/非字符串返回空', () => {
    expect(extractSelfName('')).toBe('')
    expect(extractSelfName(null)).toBe('')
    expect(extractSelfName(undefined)).toBe('')
  })

  it('TC-004 原始语料带前后文仍可捕捉', () => {
    expect(extractSelfName('你好，我叫测试员，请多关照')).toBe('测试员')
    expect(extractSelfName('大家好\n我叫测试员')).toBe('测试员')
  })
})

describe('shouldAutoCapture — 是否兜底捕捉', () => {
  it('自报句命中', () => {
    expect(shouldAutoCapture('我叫测试员')).toBe(true)
  })

  it('自报句带问号视为疑问，不捕捉', () => {
    expect(shouldAutoCapture('我叫测试员？')).toBe(false)
    expect(shouldAutoCapture('我叫测试员?')).toBe(false)
  })

  it('非自报句式不捕捉', () => {
    expect(shouldAutoCapture('测试一下')).toBe(false)
    expect(shouldAutoCapture('')).toBe(false)
  })
})
