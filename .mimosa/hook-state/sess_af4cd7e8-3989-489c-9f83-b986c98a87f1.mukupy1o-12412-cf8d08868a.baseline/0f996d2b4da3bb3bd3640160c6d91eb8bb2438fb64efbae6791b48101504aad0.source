/**
 * Markdown 解析器 — Token 级和行内级解析
 *
 * 从 MarkdownRenderer.vue 抽出，纯函数无副作用。
 * 支持：标题/粗体/斜体/删除线/列表/任务列表/代码块/链接/引用/表格/分割线/高亮
 */

/** Token 级解析：将 markdown 文本拆分为块级 token 数组 */
export function parseTokens(text) {
  if (!text) return []
  const lines = text.split('\n')
  const tokens = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    // 代码块
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]); i++
      }
      i++
      tokens.push({ type: 'code_block', lang, content: codeLines.join('\n') })
      continue
    }

    // 分割线
    if (/^(\-\-\-|\*\*\*|___)\s*$/.test(line.trim())) {
      tokens.push({ type: 'hr' }); i++; continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] })
      i++; continue
    }

    // 引用块
    if (line.trim().startsWith('>')) {
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, '')); i++
      }
      tokens.push({ type: 'blockquote', content: quoteLines.join('\n') })
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s\-:]+\|/.test(lines[i + 1].trim())) {
      const headerCells = line.split('|').map(c => c.trim()).filter(c => c !== '')
      i++
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '')
        rows.push(cells); i++
      }
      tokens.push({ type: 'table', headers: headerCells, rows })
      continue
    }

    // 任务列表
    const taskMatch = line.match(/^[\-\*]\s+\[([ xX])\]\s+(.+)$/)
    if (taskMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^[\-\*]\s+\[([ xX])\]\s+(.+)$/)
        if (!m) break
        items.push({ checked: m[1].toLowerCase() === 'x', content: m[2] }); i++
      }
      tokens.push({ type: 'task_list', items })
      continue
    }

    // 无序列表
    const ulMatch = line.match(/^[\-\*]\s+(.+)$/)
    if (ulMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^[\-\*]\s+(.+)$/)
        if (!m) break
        items.push(m[1]); i++
      }
      tokens.push({ type: 'unordered_list', items })
      continue
    }

    // 有序列表
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.+)$/)
        if (!m) break
        items.push({ num: m[1], content: m[2] }); i++
      }
      tokens.push({ type: 'ordered_list', items })
      continue
    }

    // 普通段落
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '') {
      const cur = lines[i]
      if (
        cur.trim().startsWith('```') ||
        cur.trim().startsWith('>') ||
        /^(\-\-\-|\*\*\*|___)\s*$/.test(cur.trim()) ||
        cur.match(/^(#{1,4})\s+/) ||
        cur.match(/^[\-\*]\s+/) ||
        cur.match(/^\d+\.\s+/)
      ) break
      paraLines.push(cur); i++
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', content: paraLines.join('\n') })
    }
  }
  return tokens
}

/** 行内解析：将文本拆分为带类型的行内片段 */
export function parseInline(text) {
  if (!text) return []
  const segments = []
  let remaining = text

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const strikeMatch = remaining.match(/~~(.+?)~~/)
    const markMatch = remaining.match(/==(.+?)==/)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    const candidates = []
    if (codeMatch) candidates.push({ idx: codeMatch.index, len: codeMatch[0].length, type: 'code', content: codeMatch[1] })
    if (boldMatch) candidates.push({ idx: boldMatch.index, len: boldMatch[0].length, type: 'bold', content: boldMatch[1] })
    if (strikeMatch) candidates.push({ idx: strikeMatch.index, len: strikeMatch[0].length, type: 'strike', content: strikeMatch[1] })
    if (markMatch) candidates.push({ idx: markMatch.index, len: markMatch[0].length, type: 'mark', content: markMatch[1] })
    if (italicMatch) candidates.push({ idx: italicMatch.index, len: italicMatch[0].length, type: 'italic', content: italicMatch[1] })
    if (linkMatch) candidates.push({ idx: linkMatch.index, len: linkMatch[0].length, type: 'link', content: linkMatch[1], href: linkMatch[2] })

    if (candidates.length === 0) {
      segments.push({ type: 'text', content: remaining })
      break
    }

    candidates.sort((a, b) => a.idx - b.idx)
    const first = candidates[0]

    if (first.idx > 0) {
      segments.push({ type: 'text', content: remaining.substring(0, first.idx) })
    }

    segments.push({ type: first.type, content: first.content, href: first.href })
    remaining = remaining.substring(first.idx + first.len)
  }

  return segments
}
