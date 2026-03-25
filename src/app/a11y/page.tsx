'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    hljs?: { highlightAll: () => void }
    copyCode?: (btn: HTMLElement) => void
    askQuestion?: (q: string) => void
  }
}

function ensureScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed loading script: ${src}`))
    document.head.appendChild(s)
  })
}

function ensureStylesheet(href: string) {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

export default function A11yResourcePage() {
  const [templateCss, setTemplateCss] = useState<string>('')
  const [templateBody, setTemplateBody] = useState<string>('')
  const [templateError, setTemplateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTemplate() {
      try {
        // Assets the template expects.
        ensureStylesheet(
          'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
        )
        await ensureScript('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js')

        const res = await fetch('/a11y-resource.html', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to load /a11y-resource.html (${res.status})`)
        const text = await res.text()

        const doc = new DOMParser().parseFromString(text, 'text/html')
        const css = doc.querySelector('style')?.textContent || ''

        // Remove scripts from the template HTML; we implement the behavior here.
        doc.querySelectorAll('script').forEach((n) => n.remove())

        const body = doc.body?.innerHTML || ''

        if (cancelled) return
        setTemplateCss(css)
        setTemplateBody(body)
        setTemplateError(null)
      } catch (e) {
        if (cancelled) return
        setTemplateError(e instanceof Error ? e.message : 'Failed to load /a11y template.')
      }
    }

    loadTemplate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!templateBody) return

    // Copy code blocks.
    window.copyCode = (btn: HTMLElement) => {
      const code = btn.closest('.code-block')?.querySelector('code') as HTMLElement | null
      if (!code) return
      navigator.clipboard.writeText(code.innerText).then(() => {
        const old = btn.textContent || 'Copy'
        btn.textContent = 'Copied!'
        btn.classList.add('copied')
        window.setTimeout(() => {
          btn.textContent = old === 'Copied!' ? 'Copy' : old
          btn.classList.remove('copied')
        }, 2000)
      })
    }

    const input = document.getElementById('ai-input') as HTMLInputElement | null
    const btn = document.getElementById('ai-btn') as HTMLButtonElement | null
    const btnContent = document.getElementById('ai-btn-content') as HTMLElement | null
    const result = document.getElementById('ai-result') as HTMLElement | null

    function escHtml(str: string) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function renderAnswer(text: string) {
      return String(text)
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
          `<pre><code class="language-${lang || 'html'}">${escHtml(String(code).trim())}</code></pre>`
        )
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
    }

    function showAnswer(question: string, answerText: string) {
      if (!result) return
      result.innerHTML = `
        <div class="ai-result-inner">
          <div class="ai-result-header">
            <span><span class="ai-badge">A11y AI</span> &nbsp; "${escHtml(question)}"</span>
            <button class="ai-close" aria-label="Close answer" type="button">×</button>
          </div>
          <div class="ai-result-body" id="ai-answer-body"></div>
        </div>
      `

      const closeBtn = result.querySelector('.ai-close') as HTMLButtonElement | null
      closeBtn?.addEventListener('click', () => {
        if (result) result.innerHTML = ''
      })

      const body = document.getElementById('ai-answer-body')
      if (body) body.innerHTML = renderAnswer(answerText)

      window.hljs?.highlightAll?.()
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }

    async function triggerAsk(questionOverride?: string) {
      const question = (questionOverride ?? input?.value ?? '').trim()
      if (!question || !btn || !btnContent) return

      btn.disabled = true
      btnContent.innerHTML = '<div class="spinner"></div>'
      try {
        const res = await fetch('/api/a11y-ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        })
        if (!res.ok) throw new Error('API error')
        const data = await res.json().catch(() => ({}))
        showAnswer(question, String(data?.answer ?? ''))
      } catch {
        showAnswer(question, 'Sorry, the AI is unavailable right now. Browse the reference below for answers.')
      } finally {
        btn.disabled = false
        btnContent.textContent = 'Ask A11y AI'
      }
    }

    window.askQuestion = (q: string) => {
      if (input) input.value = q
      triggerAsk(q)
    }

    const onBtnClick = () => triggerAsk()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') triggerAsk()
    }

    btn?.addEventListener('click', onBtnClick)
    input?.addEventListener('keydown', onKeyDown)

    // Sidebar active link on scroll.
    const sections = document.querySelectorAll('section[id]')
    const sidebarLinks = document.querySelectorAll('.sidebar-link')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          sidebarLinks.forEach((l) => l.classList.remove('active'))
          const active = document.querySelector(`.sidebar-link[href="#${(e.target as HTMLElement).id}"]`)
          if (active) active.classList.add('active')
        })
      },
      { rootMargin: '-60px 0px -60% 0px' }
    )
    sections.forEach((s) => observer.observe(s))

    window.hljs?.highlightAll?.()

    return () => {
      btn?.removeEventListener('click', onBtnClick)
      input?.removeEventListener('keydown', onKeyDown)
      observer.disconnect()
    }
  }, [templateBody])

  return (
    <main>
      {templateCss ? <style>{templateCss}</style> : null}
      {templateError ? (
        <div style={{ padding: 16 }}>
          <strong>Failed to load /a11y content.</strong>
          <div style={{ marginTop: 8 }}>{templateError}</div>
        </div>
      ) : null}
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: templateBody }} />
    </main>
  )
}

