/* 思迹介绍网站 - 交互：导航状态、入场动画、首屏对话演示 */

(function () {
  'use strict'

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 导航：滚动后出现分隔线
  var nav = document.getElementById('nav')
  function syncNav() {
    if (window.scrollY > 8) nav.classList.add('nav--stuck')
    else nav.classList.remove('nav--stuck')
  }
  window.addEventListener('scroll', syncNav, { passive: true })
  syncNav()

  // 入场：元素进入视口时淡入上移
  var revealNodes = Array.prototype.slice.call(document.querySelectorAll('.reveal'))
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealNodes.forEach(function (el) { el.classList.add('reveal--in') })
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--in')
          revealObserver.unobserve(entry.target)
        }
      })
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 })
    revealNodes.forEach(function (el) { revealObserver.observe(el) })
  }

  // 首屏演示：逐条播放，播完停顿再重放
  var chat = document.getElementById('chat')
  var steps = chat ? Array.prototype.slice.call(chat.querySelectorAll('[data-step]')) : []
  var timers = []

  function clearTimers() {
    timers.forEach(window.clearTimeout)
    timers = []
  }

  function play() {
    steps.forEach(function (el) { el.classList.remove('msg--in') })
    var at = 700
    steps.forEach(function (el, i) {
      timers.push(window.setTimeout(function () { el.classList.add('msg--in') }, at))
      at += i === 0 ? 900 : 1100
    })
    timers.push(window.setTimeout(play, at + 3200))
  }

  function stop() {
    clearTimers()
    steps.forEach(function (el) { el.classList.add('msg--in') })
  }

  if (steps.length) {
    if (reduceMotion) stop()
    else {
      if ('IntersectionObserver' in window && chat) {
        var chatObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { clearTimers(); play(); chatObserver.disconnect() }
          })
        }, { threshold: 0.35 })
        chatObserver.observe(chat)
      } else {
        play()
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) clearTimers()
        else play()
      })
    }
  }

  // 介绍片：滚进视口静音自动播放，滚出暂停；reduce-motion 下交回用户手动播放
  var intro = document.getElementById('intro')
  if (intro && 'IntersectionObserver' in window && !reduceMotion) {
    var introObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var played = intro.play()
          if (played && played.catch) played.catch(function () {})
        } else if (!intro.paused) {
          intro.pause()
        }
      })
    }, { threshold: 0.55 })
    introObserver.observe(intro)
  }

  var year = document.getElementById('year')
  if (year) year.textContent = String(new Date().getFullYear())
})()