'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavSection {
  id: string
  label: string
  group: string
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV: NavSection[] = [
  { group: 'Foundations',  id: 'semantic-html',   label: 'Semantic HTML' },
  { group: 'Foundations',  id: 'aria-landmarks',  label: 'ARIA Landmarks' },
  { group: 'Foundations',  id: 'aria-roles',      label: 'ARIA Roles' },
  { group: 'Foundations',  id: 'aria-states',     label: 'ARIA States & Properties' },
  { group: 'Interaction',  id: 'keyboard-nav',    label: 'Keyboard Navigation' },
  { group: 'Interaction',  id: 'focus',           label: 'Focus Management' },
  { group: 'Interaction',  id: 'skip-links',      label: 'Skip Links' },
  { group: 'Content',      id: 'forms',           label: 'Forms & Labels' },
  { group: 'Content',      id: 'images',          label: 'Images & Alt Text' },
  { group: 'Content',      id: 'colour-contrast', label: 'Colour & Contrast' },
  { group: 'Content',      id: 'live-regions',    label: 'Live Regions' },
  { group: 'Components',   id: 'modals',          label: 'Modals & Dialogs' },
  { group: 'Components',   id: 'tabs',            label: 'Tabs' },
  { group: 'Components',   id: 'accordion',       label: 'Accordion' },
  { group: 'Reference',    id: 'wcag',            label: 'WCAG Quick Reference' },
  { group: 'Reference',    id: 'testing',         label: 'Testing Checklist' },
]

const GROUPS = [...new Set(NAV.map(n => n.group))]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: '#1e3a8a', marginBottom: 4 }}>
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '1.625rem', fontWeight: 600, letterSpacing: '-.3px', lineHeight: 1.25, color: '#111827', marginBottom: 6 }}>
      {children}
    </h2>
  )
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: '#4b5563', marginTop: 6, lineHeight: 1.65, marginBottom: 0 }}>{children}</p>
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#18171a', marginBottom: 6, marginTop: 24 }}>{children}</h3>
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #e0dfd9', margin: '3rem 0' }} />
}

type CalloutType = 'tip' | 'warn' | 'bad' | 'info'
const calloutStyles: Record<CalloutType, { bg: string; border: string }> = {
  tip:  { bg: '#dcfce7', border: '#166534' },
  warn: { bg: '#fef3c7', border: '#92400e' },
  bad:  { bg: '#fee2e2', border: '#991b1b' },
  info: { bg: '#e8eeff', border: '#4f74d4' },
}
const calloutIcons: Record<CalloutType, string> = { tip: '✓', warn: '⚠', bad: '✕', info: 'ℹ' }

function Callout({ type, children }: { type: CalloutType; children: React.ReactNode }) {
  const s = calloutStyles[type]
  return (
    <div style={{ display: 'flex', gap: 12, padding: '1rem 1.25rem', borderRadius: 8, margin: '1rem 0', background: s.bg, borderLeft: `3px solid ${s.border}` }}>
      <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>{calloutIcons[type]}</span>
      <div style={{ fontSize: 14, color: '#18171a', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const dotColor: Record<string, string> = { html: '#e34c26', css: '#264de4', js: '#f0db4f', javascript: '#f0db4f', jsx: '#61dafb' }

  function copy() {
    navigator.clipboard.writeText(children.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ margin: '1rem 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a35' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#252530', padding: '.5rem 1rem', fontFamily: 'monospace', fontSize: 12, color: '#c9cdd8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[lang] || '#888', display: 'inline-block' }} />
          {lang.toUpperCase()}
        </div>
        <button onClick={copy} style={{ background: 'none', border: '1px solid #4b4b5c', color: copied ? '#22c55e' : '#c9cdd8', padding: '3px 10px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0} aria-label="Code example" style={{ margin: 0, background: '#1c1c24', overflowX: 'auto' }}>
        <code style={{ display: 'block', padding: '1.25rem', fontSize: 13.5, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: 1.6, color: '#e0e0f0', whiteSpace: 'pre' }}>
          {children.trim()}
        </code>
      </pre>
    </div>
  )
}

function WcagTable({ rows }: { rows: { id: string; level: 'A' | 'AA' | 'AAA'; summary: string; isNew?: boolean }[] }) {
  const levelColor: Record<string, { bg: string; color: string }> = {
    A:   { bg: '#dbeafe', color: '#1e40af' },
    AA:  { bg: '#e8eeff', color: '#1746a2' },
    AAA: { bg: '#ede9fe', color: '#5b21b6' },
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '1rem 0' }}>
      <thead>
        <tr>
          {['Criterion', 'Level', 'Summary'].map(h => (
            <th key={h} style={{ background: '#f3f2ee', padding: '.6rem .9rem', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: '#4a4a52', borderBottom: '1px solid #e0dfd9' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const lc = levelColor[r.level]
          return (
            <tr key={r.id} style={{ borderBottom: '1px solid #e0dfd9' }}>
              <td style={{ padding: '.65rem .9rem', color: '#3f3f46', verticalAlign: 'top' }}>
                <strong>{r.id}</strong>
                {r.isNew && <span style={{ marginLeft: 6, background: '#bbf7d0', color: '#052e16', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>New 2.2</span>}
              </td>
              <td style={{ padding: '.65rem .9rem', verticalAlign: 'top' }}>
                <span style={{ background: lc.bg, color: lc.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{r.level}</span>
              </td>
              <td style={{ padding: '.65rem .9rem', color: '#3f3f46', verticalAlign: 'top' }}>{r.summary}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── AI Ask ───────────────────────────────────────────────────────────────────

type AiAnswer = { q: string; a: string } | null

function renderAiAnswerContent(text: string) {
  const blocks: Array<{ type: 'text' | 'code'; value: string; lang?: string }> = []
  const codeRe = /```(\w+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', value: text.slice(lastIndex, match.index).trim() })
    }
    blocks.push({ type: 'code', lang: (match[1] || '').trim(), value: (match[2] || '').trim() })
    lastIndex = codeRe.lastIndex
  }
  if (lastIndex < text.length) {
    blocks.push({ type: 'text', value: text.slice(lastIndex).trim() })
  }

  return blocks.map((block, idx) => {
    if (block.type === 'code') {
      return (
        <div key={`code-${idx}`} style={{ marginTop: idx === 0 ? 0 : 12, border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {block.lang ? (
            <div style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 700, color: '#374151', padding: '6px 10px', textTransform: 'uppercase' }}>
              {block.lang}
            </div>
          ) : null}
          <pre tabIndex={0} aria-label="AI code example" style={{ margin: 0, background: '#111827', color: '#e5e7eb', padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.6 }}>
            <code>{block.value}</code>
          </pre>
        </div>
      )
    }

    const paragraphs = block.value.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

    const sectionCards = paragraphs.map((p, pIdx) => {
      const clean = p.replace(/^"+|"+$/g, '').trim()
      const headingMatch =
        clean.match(/^\*\*([^*:\n]{2,80}):\*\*\s*(.*)$/) ||
        clean.match(/^([A-Za-z][A-Za-z0-9 /&()-]{2,60}):\s*(.*)$/)

      const title = headingMatch ? headingMatch[1].trim() : pIdx === 0 ? 'Answer' : ''
      const body = headingMatch ? (headingMatch[2] || '').trim() : clean

      const bulletParts = body
        .split(/\s+[•·]\s+|\s+-\s+/)
        .map(item => item.trim())
        .filter(Boolean)

      const numberedItems = body
        .split(/\s+(?=\d+\.\s)/)
        .map(item => item.trim())
        .filter(Boolean)

      const asList = numberedItems.length >= 2 ? numberedItems : bulletParts.length >= 2 ? bulletParts : []

      return (
        <div
          key={`card-${idx}-${pIdx}`}
          style={{
            marginTop: pIdx === 0 ? 0 : 10,
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: '#f9fafb',
            overflow: 'hidden',
          }}
        >
          {title ? (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.4px' }}>
              {title}
            </div>
          ) : null}
          <div style={{ padding: '10px 12px', color: '#1f2937' }}>
            {asList.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {asList.map((item, itemIdx) => (
                  <li key={`li-${idx}-${pIdx}-${itemIdx}`} style={{ marginBottom: itemIdx === asList.length - 1 ? 0 : 6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0 }}>{body}</p>
            )}
          </div>
        </div>
      )
    })

    return <div key={`text-${idx}`} style={{ marginTop: idx === 0 ? 0 : 10 }}>{sectionCards}</div>
  })
}

function AiAsk({ setAnswer }: { setAnswer: (value: AiAnswer) => void }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  const hints = [
    'How do I make a custom dropdown accessible?',
    'What ARIA attributes does a modal need?',
    'How to test keyboard navigation?',
    'What is WCAG 2.2 and what changed?',
  ]

  async function ask(q?: string) {
    const query = (q ?? question).trim()
    if (!query) return
    setLoading(true)
    try {
      const res = await fetch('/api/a11y-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      })
      const data = await res.json()
      setAnswer({ q: query, a: data.answer ?? '' })
    } catch {
      setAnswer({ q: query, a: 'Sorry, the AI is unavailable right now. Browse the reference below for answers.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: 'min(760px, 94vw)', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.22)' }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="e.g. How do I make a modal dialog accessible?"
          maxLength={240}
          aria-label="Ask an accessibility question"
          style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: '#111827', padding: '5px 8px', outline: 'none' }}
        />
        <button
          onClick={() => ask()}
          disabled={loading}
          style={{ background: loading ? '#6b7280' : '#0B1220', color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer', padding: '9px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          {loading ? 'Asking…' : 'Ask A11y AI'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 8, textAlign: 'center' }}>
        Try:{' '}
        {hints.map(h => (
          <button key={h} onClick={() => { setQuestion(h); ask(h) }}
            style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 10, margin: '0 2px', cursor: 'pointer', color: '#111827' }}>
            {h.split(' ').slice(0, 3).join(' ')}…
          </button>
        ))}
      </p>

    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function A11yPage() {
  const [activeId, setActiveId] = useState<string>('semantic-html')
  const [aiAnswer, setAiAnswer] = useState<AiAnswer>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Intersection observer for active nav link
  useEffect(() => {
    const sections = document.querySelectorAll('section[data-section]')
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveId((e.target as HTMLElement).dataset.section ?? '')
        })
      },
      { rootMargin: '-80px 0px -60% 0px' }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html { scroll-padding-top: 80px; }
        .a11y-page { font-family: 'DM Sans', system-ui, sans-serif; font-size: 16px; line-height: 1.7; color: #18171a; background: #f9fafb; -webkit-font-smoothing: antialiased; min-height: 100vh; }
        .a11y-page p { margin: 0 0 1rem; }
        .a11y-content a { color: #1d4ed8; }
        .skip-to-main { position: absolute; top: -60px; left: 1rem; background: #0B1220; color: #fff; padding: .5rem 1rem; border-radius: 0 0 8px 8px; font-weight: 500; font-size: 14px; z-index: 200; transition: top .15s; }
        .skip-to-main:focus { top: 0; }
        .a11y-topnav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,.95); backdrop-filter: blur(12px); border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; height: 60px; }
        .a11y-hero {
          background: radial-gradient(1200px 400px at 20% 100%, #0891b2 0%, rgba(8,145,178,0) 60%),
                      linear-gradient(120deg, #0e7490 0%, #0b3d63 45%, #081a33 100%);
          border-bottom: 1px solid #0f3a57;
          padding: 3.25rem 2rem 2.25rem;
          text-align: center;
        }
        .a11y-quick-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 1.25rem 2rem; border-bottom: 1px solid #e5e7eb; background: #fff; }
        .a11y-qtag { background: #fff; border: 1px solid #e5e7eb; border-radius: 100px; padding: 5px 14px; font-size: 13px; color: #4b5563; cursor: pointer; transition: all .15s; font-family: inherit; }
        .a11y-qtag:hover { background: #f0f9ff; border-color: #bae6fd; color: #0B1220; }
        .a11y-layout { display: grid; grid-template-columns: 256px 1fr; max-width: 1300px; margin: 0 auto; }
        .a11y-sidebar { position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; padding: 1.5rem 1rem 2rem; border-right: 1px solid #e5e7eb; }
        .a11y-sidebar::-webkit-scrollbar { width: 4px; }
        .a11y-sidebar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
        .a11y-sidebar-group { margin-bottom: 1.5rem; }
        .a11y-sidebar-heading { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #374151; padding: 0 8px; margin-bottom: 4px; }
        .a11y-sidebar-link { display: block; padding: 5px 8px; font-size: 13.5px; color: #4b5563; border-radius: 6px; cursor: pointer; transition: all .1s; line-height: 1.4; font-family: inherit; background: none; border: none; width: 100%; text-align: left; }
        .a11y-sidebar-link:hover { background: #f3f4f6; color: #111827; }
        .a11y-sidebar-link.active { background: #e0f2fe; color: #0B1220; font-weight: 600; }
        .a11y-content { padding: 2.5rem 3rem; max-width: 840px; }
        .a11y-section { margin-bottom: 4rem; scroll-margin-top: 80px; }
        @media (max-width: 900px) {
          .a11y-layout { grid-template-columns: 1fr; }
          .a11y-sidebar { display: none; }
          .a11y-content { padding: 1.5rem; }
        }
        @media (max-width: 640px) {
          .a11y-topnav-links { display: none; }
          .a11y-hero { padding: 2.5rem 1.25rem 2rem; }
        }
      `}</style>

      <div className="a11y-page">
        <a href="#main-content" className="skip-to-main">Skip to main content</a>

        {/* Top Nav */}
        <nav className="a11y-topnav" aria-label="Site navigation">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <a className="flex items-center gap-2" aria-label="a11ytest.ai home" href="/home">
              <img src="/allytest.png" alt="a11ytest.ai" className="h-8 w-auto object-contain" />
            </a>
            <ul className="hidden items-center gap-2 sm:flex" role="list" aria-label="Top navigation">
              <li role="listitem"><a className="rounded-lg px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 text-gray-900 hover:bg-sky-50 hover:text-[#0B1220]" href="/accessibility-issues">Issues Demo</a></li>
              <li role="listitem"><a className="rounded-lg px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 text-gray-900 hover:bg-sky-50 hover:text-[#0B1220]" href="/logo-contrast-checker">Logo Checker</a></li>
              <li role="listitem"><a className="rounded-lg px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 text-gray-900 hover:bg-sky-50 hover:text-[#0B1220]" href="/playground">Playground</a></li>
              <li role="listitem"><a className="rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#081a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2" href="/signup">Get started →</a></li>
            </ul>
            <div className="sm:hidden">
              <a className="rounded-lg bg-[#0B1220] px-3 py-2 text-sm font-extrabold text-white hover:bg-[#081a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2" href="/signup">Get started →</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <header className="a11y-hero">
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.25rem)', fontWeight: 700, letterSpacing: '-.5px', lineHeight: 1.15, color: '#f9fafb', marginBottom: '.6rem' }}>
            The Complete <span style={{ color: '#38bdf8' }}>A11y</span> Reference
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#dbeafe', maxWidth: 640, margin: '0 auto .25rem' }}>
            Every accessibility pattern, code example, and WCAG criterion in one place. Ask any question and get an instant answer with working code.
          </p>
          <AiAsk setAnswer={setAiAnswer} />
        </header>

        {aiAnswer && (
          <section style={{ maxWidth: 980, margin: '1.25rem auto 0', padding: '0 1rem' }} aria-label="AI answer section">
            <div style={{ background: '#fff', border: '1px solid #e0dfd9', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.75rem 1.25rem', background: '#f3f2ee', borderBottom: '1px solid #e0dfd9', fontSize: 13, fontWeight: 500, color: '#3f3f46' }}>
                <span>
                  <span style={{ background: '#e0f2fe', color: '#0B1220', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginRight: 8 }}>A11y AI</span>
                  "{aiAnswer.q}"
                </span>
                <button onClick={() => setAiAnswer(null)} aria-label="Close answer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a4a52', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>×</button>
              </div>
              <div tabIndex={0} aria-label="AI answer content" style={{ padding: '1.25rem', fontSize: 15, lineHeight: 1.7, color: '#18171a', maxHeight: 460, overflowY: 'auto' }}>
                {renderAiAnswerContent(aiAnswer.a)}
              </div>
            </div>
          </section>
        )}

        {/* Quick nav tags */}
        <nav className="a11y-quick-tags" aria-label="Jump to topic">
          {NAV.map(n => (
            <button key={n.id} className="a11y-qtag" onClick={() => scrollTo(n.id)}>{n.label}</button>
          ))}
        </nav>

        {/* Layout */}
        <div className="a11y-layout">

          {/* Sidebar */}
          <aside className="a11y-sidebar" aria-label="Section navigation">
            {GROUPS.map(group => (
              <div key={group} className="a11y-sidebar-group">
                <p className="a11y-sidebar-heading">{group}</p>
                {NAV.filter(n => n.group === group).map(n => (
                  <button
                    key={n.id}
                    className={`a11y-sidebar-link${activeId === n.id ? ' active' : ''}`}
                    onClick={() => scrollTo(n.id)}
                    aria-current={activeId === n.id ? 'true' : undefined}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Main content */}
          <main id="main-content" ref={contentRef} className="a11y-content">

            {/* ── Semantic HTML ── */}
            <section className="a11y-section" id="semantic-html" data-section="semantic-html">
              <SectionTag>Foundations</SectionTag>
              <SectionHeading>Semantic HTML</SectionHeading>
              <SectionIntro>The most powerful accessibility tool is already built into HTML. Using the right element for the right job gives screen readers, search engines, and browsers the context they need — for free, with no ARIA required.</SectionIntro>
              <SubHeading>Document structure</SubHeading>
              <CodeBlock lang="html">{`<!-- Good: landmark regions give structure -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main id="main-content">
  <article>
    <h1>Page title</h1>
    <section aria-labelledby="section-heading">
      <h2 id="section-heading">Section title</h2>
      <p>Content...</p>
    </section>
  </article>
</main>

<footer>
  <p>&copy; 2025 Company</p>
</footer>`}</CodeBlock>
              <SubHeading>Heading hierarchy</SubHeading>
              <Callout type="warn"><strong>Never skip heading levels.</strong> Going from h1 → h3 confuses screen reader users who navigate by headings. Use CSS to control size, not heading levels.</Callout>
              <CodeBlock lang="html">{`<!-- Bad: skipping heading levels -->
<h1>Page title</h1>
<h3>Section</h3>   <!-- jumped from h1 to h3 -->

<!-- Good: logical hierarchy -->
<h1>Page title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Another section</h2>`}</CodeBlock>
              <SubHeading>Interactive elements</SubHeading>
              <CodeBlock lang="html">{`<!-- Bad: div used as button -->
<div onclick="submit()">Submit</div>

<!-- Good: use the native element -->
<button type="submit">Submit</button>

<!-- If you MUST use a div as a button -->
<div role="button" tabindex="0"
     onkeydown="if(e.key==='Enter'||e.key===' ')submit()"
     onclick="submit()">
  Submit
</div>`}</CodeBlock>
            </section>

            <Divider />

            {/* ── ARIA Landmarks ── */}
            <section className="a11y-section" id="aria-landmarks" data-section="aria-landmarks">
              <SectionTag>Foundations</SectionTag>
              <SectionHeading>ARIA Landmarks</SectionHeading>
              <SectionIntro>Landmarks carve the page into navigable sections. Screen reader users rely on them to jump around quickly — similar to how sighted users scan visually.</SectionIntro>
              <CodeBlock lang="html">{`<!-- HTML5 elements map to landmark roles automatically -->
<header>     <!-- role="banner" (only when top-level) -->
<nav>        <!-- role="navigation" -->
<main>       <!-- role="main" -->
<aside>      <!-- role="complementary" -->
<footer>     <!-- role="contentinfo" (only when top-level) -->
<section>    <!-- role="region" only when given a label -->

<!-- When you have multiple navs, label them -->
<nav aria-label="Main navigation">...</nav>
<nav aria-label="Breadcrumb">...</nav>
<nav aria-label="Pagination">...</nav>

<!-- Section needs a label to become a landmark -->
<section aria-labelledby="news-heading">
  <h2 id="news-heading">Latest news</h2>
</section>`}</CodeBlock>
              <Callout type="tip"><strong>Rule of thumb:</strong> one <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>&lt;main&gt;</code> per page. Multiple <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>&lt;nav&gt;</code> elements are fine — just label each one uniquely.</Callout>
            </section>

            <Divider />

            {/* ── ARIA Roles ── */}
            <section className="a11y-section" id="aria-roles" data-section="aria-roles">
              <SectionTag>Foundations</SectionTag>
              <SectionHeading>ARIA Roles</SectionHeading>
              <SectionIntro>When native HTML doesn't cover a pattern, ARIA roles let you communicate the purpose of custom components to assistive technology.</SectionIntro>
              <Callout type="warn"><strong>First rule of ARIA:</strong> don't use ARIA when native HTML works. Adding role="button" to a div still requires you to manually handle keyboard events, focus, and state.</Callout>
              <CodeBlock lang="html">{`<!-- Widget roles -->
<div role="button">        <!-- interactive button -->
<div role="checkbox">      <!-- checkable item -->
<div role="combobox">      <!-- editable dropdown -->
<div role="listbox">       <!-- list of selectable options -->
<div role="menu">          <!-- context/action menu -->
<div role="menuitem">      <!-- item in a menu -->
<div role="option">        <!-- option in a listbox/combobox -->
<div role="progressbar">   <!-- progress indicator -->
<div role="switch">        <!-- toggle on/off -->
<div role="tab">           <!-- a tab in a tablist -->
<div role="tablist">       <!-- container of tabs -->
<div role="tabpanel">      <!-- content for a tab -->
<div role="tooltip">       <!-- tooltip -->

<!-- Document roles -->
<div role="alert">         <!-- urgent message (assertive) -->
<div role="dialog">        <!-- modal or non-modal dialog -->
<div role="status">        <!-- non-urgent status message -->`}</CodeBlock>
            </section>

            <Divider />

            {/* ── ARIA States ── */}
            <section className="a11y-section" id="aria-states" data-section="aria-states">
              <SectionTag>Foundations</SectionTag>
              <SectionHeading>ARIA States & Properties</SectionHeading>
              <SectionIntro>States describe the current condition of a component. Properties describe its nature. Both must be updated dynamically as the UI changes.</SectionIntro>
              <CodeBlock lang="html">{`<!-- Labelling -->
<button aria-label="Close dialog">✕</button>
<input aria-labelledby="label-id">
<input aria-describedby="help-text-id">

<!-- State -->
<button aria-expanded="false">Show more</button>
<div aria-hidden="true">Decorative, hidden from AT</div>
<li role="option" aria-selected="true">Option A</li>
<input type="checkbox" aria-checked="mixed"> <!-- indeterminate -->
<button aria-disabled="true">Can't do this</button>
<input aria-required="true">
<input aria-invalid="true" aria-describedby="err">
<span id="err" role="alert">Required field</span>`}</CodeBlock>
              <CodeBlock lang="javascript">{`// Dynamic update in JS
const btn = document.querySelector('#toggle');
btn.addEventListener('click', () => {
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', !expanded);
  document.getElementById('panel').hidden = expanded;
});`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Keyboard Nav ── */}
            <section className="a11y-section" id="keyboard-nav" data-section="keyboard-nav">
              <SectionTag>Interaction</SectionTag>
              <SectionHeading>Keyboard Navigation</SectionHeading>
              <SectionIntro>All functionality must be operable by keyboard alone. WCAG 2.1.1 (Level A) requires no mouse dependency.</SectionIntro>
              <SubHeading>Standard keyboard conventions</SubHeading>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '1rem 0' }}>
                <thead>
                  <tr>{['Key', 'Expected action'].map(h => <th key={h} style={{ background: '#f3f2ee', padding: '.6rem .9rem', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: '#4a4a52', borderBottom: '1px solid #e0dfd9' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ['Tab', 'Move focus to next focusable element'],
                    ['Shift+Tab', 'Move focus to previous focusable element'],
                    ['Enter', 'Activate a button, link, or submit a form'],
                    ['Space', 'Activate a button; toggle a checkbox'],
                    ['Arrow keys', 'Navigate within a widget (tabs, menus, sliders)'],
                    ['Escape', 'Close a dialog, menu, or tooltip'],
                    ['Home / End', 'Jump to first/last item in a list'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #e0dfd9' }}>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46' }}><code style={{ fontFamily: 'monospace', fontSize: 13, background: '#f3f2ee', border: '1px solid #e0dfd9', padding: '1px 5px', borderRadius: 3 }}>{k}</code></td>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SubHeading>tabindex rules</SubHeading>
              <CodeBlock lang="html">{`<!-- tabindex="0" — add to tab order (natural DOM position) -->
<div role="button" tabindex="0">Custom button</div>

<!-- tabindex="-1" — focusable by script, not by Tab -->
<div id="panel" tabindex="-1">Dialog panel</div>

<!-- tabindex="1+" — AVOID. Forces unnatural tab order -->
<button tabindex="3">Don't do this</button>`}</CodeBlock>
              <SubHeading>Keyboard event handling</SubHeading>
              <CodeBlock lang="javascript">{`// Handle both Enter and Space for custom buttons
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
});

// Arrow key navigation in a menu
const items = menu.querySelectorAll('[role="menuitem"]');
let currentIndex = 0;

menu.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentIndex = (currentIndex + 1) % items.length;
    items[currentIndex].focus();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    items[currentIndex].focus();
  }
  if (e.key === 'Escape') closeMenu();
});`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Focus ── */}
            <section className="a11y-section" id="focus" data-section="focus">
              <SectionTag>Interaction</SectionTag>
              <SectionHeading>Focus Management</SectionHeading>
              <SectionIntro>Managing focus means moving it deliberately when the UI changes — opening a modal, loading new content, or completing a task.</SectionIntro>
              <Callout type="bad"><strong>Never do this:</strong> <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>:focus {'{ outline: none }'}</code> — this removes focus visibility for keyboard users. WCAG 2.4.11 (AA) requires visible focus indicators.</Callout>
              <CodeBlock lang="css">{`/* Good: visible and branded focus styles */
:focus-visible {
  outline: 3px solid #1746a2;
  outline-offset: 3px;
  border-radius: 3px;
}

/* For dark backgrounds */
.dark-bg:focus-visible {
  outline: 3px solid #fff;
  box-shadow: 0 0 0 5px #1746a2;
}`}</CodeBlock>
              <SubHeading>Focus trapping (modals)</SubHeading>
              <CodeBlock lang="javascript">{`function trapFocus(element) {
  const focusable = [...element.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus(); e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    }
  });
}`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Skip Links ── */}
            <section className="a11y-section" id="skip-links" data-section="skip-links">
              <SectionTag>Interaction</SectionTag>
              <SectionHeading>Skip Links</SectionHeading>
              <SectionIntro>Skip links let keyboard users jump past repeated navigation to the main content. Required by WCAG 2.4.1 (Level A).</SectionIntro>
              <CodeBlock lang="html">{`<!-- First element in <body> -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- The target must be focusable -->
<main id="main-content" tabindex="-1">
  <h1>Page title</h1>
</main>`}</CodeBlock>
              <CodeBlock lang="css">{`.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  padding: .5rem 1rem;
  background: #1746a2;
  color: #fff;
  font-weight: 600;
  border-radius: 0 0 8px 8px;
  z-index: 9999;
  transition: top 0.15s;
}
.skip-link:focus { top: 0; }`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Forms ── */}
            <section className="a11y-section" id="forms" data-section="forms">
              <SectionTag>Content</SectionTag>
              <SectionHeading>Forms & Labels</SectionHeading>
              <SectionIntro>Every input must have a programmatic label, errors must be clearly associated with their fields, and required fields must be communicated to all users.</SectionIntro>
              <CodeBlock lang="html">{`<!-- Method 1: explicit label (preferred) -->
<label for="email">Email address</label>
<input type="email" id="email" name="email">

<!-- Method 2: wrapping label -->
<label>
  Email address
  <input type="email" name="email">
</label>

<!-- Method 3: aria-label (when no visible label) -->
<input type="search" aria-label="Search products">

<!-- Placeholder is NOT a label -->
<input placeholder="Email"> <!-- bad alone — pair with a label -->

<!-- Required fields + error state -->
<label for="name">
  Full name <span aria-hidden="true">*</span>
</label>
<input type="text" id="name" required aria-required="true"
       aria-invalid="true" aria-describedby="name-error">
<p id="name-error" role="alert">This field is required</p>

<!-- Group related inputs -->
<fieldset>
  <legend>Notification preferences</legend>
  <label><input type="checkbox" name="email-notify"> Email</label>
  <label><input type="checkbox" name="sms-notify"> SMS</label>
</fieldset>`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Images ── */}
            <section className="a11y-section" id="images" data-section="images">
              <SectionTag>Content</SectionTag>
              <SectionHeading>Images & Alt Text</SectionHeading>
              <SectionIntro>Every meaningful image needs alternative text. The quality of alt text matters as much as its presence — it should convey purpose, not just describe literally.</SectionIntro>
              <CodeBlock lang="html">{`<!-- Meaningful image: describe purpose, not appearance -->
<img src="logo.png" alt="a11ytest.ai">

<!-- Decorative image: empty alt suppresses from screen readers -->
<img src="decoration.svg" alt="">

<!-- Functional image (inside a link): describe destination -->
<a href="/dashboard">
  <img src="icon-dashboard.svg" alt="Dashboard">
</a>

<!-- Complex image: use figcaption for long description -->
<figure>
  <img src="chart.png"
       alt="Sales chart for Q3 2025"
       aria-describedby="chart-desc">
  <figcaption id="chart-desc">
    Line chart showing revenue growing from £120k in July
    to £180k in September.
  </figcaption>
</figure>

<!-- Inline SVG: use title + desc -->
<svg role="img" aria-labelledby="svg-title svg-desc">
  <title id="svg-title">Upload progress</title>
  <desc id="svg-desc">65% of file uploaded</desc>
</svg>

<!-- Decorative SVG: hide completely -->
<svg aria-hidden="true" focusable="false">...</svg>`}</CodeBlock>
              <Callout type="info">Don't start alt text with "Image of" or "Photo of" — screen readers already announce "image". For logos, just use the brand name.</Callout>
            </section>

            <Divider />

            {/* ── Colour Contrast ── */}
            <section className="a11y-section" id="colour-contrast" data-section="colour-contrast">
              <SectionTag>Content</SectionTag>
              <SectionHeading>Colour & Contrast</SectionHeading>
              <SectionIntro>Roughly 300 million people have colour vision deficiency. WCAG contrast requirements ensure text is readable for users with low vision or on poor screens.</SectionIntro>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '1rem 0' }}>
                <thead><tr>{['Content type', 'Level AA', 'Level AAA'].map(h => <th key={h} style={{ background: '#f3f2ee', padding: '.6rem .9rem', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: '#4a4a52', borderBottom: '1px solid #e0dfd9' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[
                    ['Normal text (under 18pt / 14pt bold)', '4.5:1', '7:1'],
                    ['Large text (18pt+ or 14pt+ bold)', '3:1', '4.5:1'],
                    ['UI components & graphics', '3:1', '—'],
                    ['Focus indicator (WCAG 2.4.11)', '3:1', '—'],
                  ].map(([t, aa, aaa]) => (
                    <tr key={t} style={{ borderBottom: '1px solid #e0dfd9' }}>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46' }}>{t}</td>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46', fontWeight: 500 }}>{aa}</td>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46' }}>{aaa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Callout type="warn"><strong>Don't rely on colour alone.</strong> WCAG 1.4.1: if colour is the only way to convey information (e.g. red = error), users with colour blindness will miss it. Add icons, patterns, or text labels alongside colour.</Callout>
            </section>

            <Divider />

            {/* ── Live Regions ── */}
            <section className="a11y-section" id="live-regions" data-section="live-regions">
              <SectionTag>Content</SectionTag>
              <SectionHeading>Live Regions</SectionHeading>
              <SectionIntro>Live regions announce dynamic content changes to screen reader users without requiring a page reload or focus change.</SectionIntro>
              <CodeBlock lang="html">{`<!-- aria-live="polite": announces after user is idle -->
<div aria-live="polite" aria-atomic="true" id="status"></div>

<!-- role="status" = polite live region (shorthand) -->
<div role="status">3 results found</div>

<!-- role="alert" = assertive, interrupts immediately -->
<div role="alert">Error: session expired</div>`}</CodeBlock>
              <CodeBlock lang="javascript">{`function announce(message, priority = 'polite') {
  const el = document.createElement('div');
  el.setAttribute('aria-live', priority);
  el.setAttribute('aria-atomic', 'true');
  el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)';
  document.body.appendChild(el);
  setTimeout(() => { el.textContent = message; }, 100);
  setTimeout(() => { el.remove(); }, 5000);
}

announce('Form submitted successfully');
announce('Error: email already in use', 'assertive');`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Modals ── */}
            <section className="a11y-section" id="modals" data-section="modals">
              <SectionTag>Components</SectionTag>
              <SectionHeading>Modals & Dialogs</SectionHeading>
              <SectionIntro>Accessible modals require three things: move focus in on open, trap focus inside, and return focus to the trigger on close.</SectionIntro>
              <CodeBlock lang="html">{`<button id="open-modal">Open dialog</button>

<div role="dialog"
     id="my-modal"
     aria-modal="true"
     aria-labelledby="modal-title"
     aria-describedby="modal-desc"
     hidden>
  <h2 id="modal-title">Confirm deletion</h2>
  <p id="modal-desc">This action cannot be undone.</p>
  <button type="button" id="confirm-btn">Delete</button>
  <button type="button" id="cancel-btn">Cancel</button>
  <button type="button" aria-label="Close dialog">✕</button>
</div>`}</CodeBlock>
              <CodeBlock lang="javascript">{`const modal = document.getElementById('my-modal');
let previousFocus;

function openModal() {
  previousFocus = document.activeElement;  // remember trigger
  modal.hidden = false;
  modal.querySelector('button').focus();   // move focus in
  document.addEventListener('keydown', handleEscape);
}

function closeModal() {
  modal.hidden = true;
  document.removeEventListener('keydown', handleEscape);
  previousFocus?.focus();                  // return focus to trigger
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}`}</CodeBlock>
              <Callout type="tip">Use the native <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>&lt;dialog&gt;</code> element where possible — it handles focus trapping, aria-modal, and Escape for you automatically.</Callout>
            </section>

            <Divider />

            {/* ── Tabs ── */}
            <section className="a11y-section" id="tabs" data-section="tabs">
              <SectionTag>Components</SectionTag>
              <SectionHeading>Tabs</SectionHeading>
              <SectionIntro>The ARIA tab pattern uses a tablist container, individual tab elements, and associated tabpanel regions. Arrow keys navigate between tabs.</SectionIntro>
              <CodeBlock lang="html">{`<div role="tablist" aria-label="Account settings">
  <button role="tab"
          id="tab-profile"
          aria-controls="panel-profile"
          aria-selected="true"
          tabindex="0">
    Profile
  </button>
  <button role="tab"
          id="tab-security"
          aria-controls="panel-security"
          aria-selected="false"
          tabindex="-1">
    Security
  </button>
</div>

<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
  Profile content...
</div>
<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" hidden>
  Security content...
</div>`}</CodeBlock>
              <CodeBlock lang="javascript">{`const tabs = [...tablist.querySelectorAll('[role="tab"]')];

function activateTab(tab) {
  tabs.forEach(t => {
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
    document.getElementById(t.getAttribute('aria-controls')).hidden = true;
  });
  tab.setAttribute('aria-selected', 'true');
  tab.setAttribute('tabindex', '0');
  document.getElementById(tab.getAttribute('aria-controls')).hidden = false;
  tab.focus();
}

tablist.addEventListener('keydown', (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (e.key === 'ArrowRight') activateTab(tabs[(i + 1) % tabs.length]);
  if (e.key === 'ArrowLeft')  activateTab(tabs[(i - 1 + tabs.length) % tabs.length]);
});`}</CodeBlock>
            </section>

            <Divider />

            {/* ── Accordion ── */}
            <section className="a11y-section" id="accordion" data-section="accordion">
              <SectionTag>Components</SectionTag>
              <SectionHeading>Accordion</SectionHeading>
              <SectionIntro>Accordion headers are buttons with aria-expanded controlling the visibility of their associated panel.</SectionIntro>
              <CodeBlock lang="html">{`<h3>
  <button type="button"
    aria-expanded="false"
    aria-controls="panel-1"
    id="btn-1">
    What is WCAG?
  </button>
</h3>
<div id="panel-1" role="region" aria-labelledby="btn-1" hidden>
  <p>WCAG stands for Web Content Accessibility Guidelines...</p>
</div>`}</CodeBlock>
              <CodeBlock lang="javascript">{`document.querySelectorAll('.accordion button').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', !expanded);
    panel.hidden = expanded;
  });
});`}</CodeBlock>
            </section>

            <Divider />

            {/* ── WCAG ── */}
            <section className="a11y-section" id="wcag" data-section="wcag">
              <SectionTag>Reference</SectionTag>
              <SectionHeading>WCAG Quick Reference</SectionHeading>
              <SectionIntro>WCAG 2.2 (October 2023) has four principles: Perceivable, Operable, Understandable, and Robust. Most regulations require Level AA.</SectionIntro>
              <WcagTable rows={[
                { id: '1.1.1 Non-text Content',        level: 'A',   summary: 'All non-text content has a text alternative' },
                { id: '1.3.1 Info and Relationships',  level: 'A',   summary: 'Structure conveyed visually is in the code' },
                { id: '1.4.1 Use of Colour',           level: 'A',   summary: 'Colour not the sole means of conveying info' },
                { id: '1.4.3 Contrast (Minimum)',      level: 'AA',  summary: '4.5:1 for normal text, 3:1 for large text' },
                { id: '1.4.4 Resize Text',             level: 'AA',  summary: 'Text resizable to 200% without loss of content' },
                { id: '1.4.10 Reflow',                 level: 'AA',  summary: 'No horizontal scroll at 320px width' },
                { id: '1.4.11 Non-text Contrast',      level: 'AA',  summary: '3:1 for UI components and graphics' },
                { id: '2.1.1 Keyboard',                level: 'A',   summary: 'All functionality available by keyboard' },
                { id: '2.4.1 Bypass Blocks',           level: 'A',   summary: 'Skip links to bypass repeated navigation' },
                { id: '2.4.3 Focus Order',             level: 'A',   summary: 'Focus order preserves meaning and operability' },
                { id: '2.4.7 Focus Visible',           level: 'AA',  summary: 'Keyboard focus indicator visible' },
                { id: '2.4.11 Focus Appearance',       level: 'AA',  summary: 'Focus indicator meets minimum size and contrast', isNew: true },
                { id: '2.5.7 Dragging Movements',      level: 'AA',  summary: 'All drag actions have a pointer alternative', isNew: true },
                { id: '2.5.8 Target Size',             level: 'AA',  summary: 'Minimum 24×24px touch target size', isNew: true },
                { id: '3.1.1 Language of Page',        level: 'A',   summary: 'lang attribute on <html>' },
                { id: '3.3.1 Error Identification',    level: 'A',   summary: 'Errors identified in text' },
                { id: '3.3.2 Labels or Instructions',  level: 'A',   summary: 'Labels provided for user inputs' },
                { id: '3.3.7 Redundant Entry',         level: 'A',   summary: "Don't ask for the same info twice in a process", isNew: true },
                { id: '4.1.2 Name, Role, Value',       level: 'A',   summary: 'UI components expose name, role, state to AT' },
                { id: '4.1.3 Status Messages',         level: 'AA',  summary: 'Status messages programmatically determined' },
              ]} />
            </section>

            <Divider />

            {/* ── Testing ── */}
            <section className="a11y-section" id="testing" data-section="testing">
              <SectionTag>Reference</SectionTag>
              <SectionHeading>Testing Checklist</SectionHeading>
              <SectionIntro>A good accessibility test combines automated scanning (catches ~30–40% of issues) with manual keyboard and screen reader testing.</SectionIntro>
              <table tabIndex={0} aria-label="Testing checklist table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '1rem 0' }}>
                <thead><tr>{['#', 'Test', 'What to check'].map(h => <th key={h} style={{ background: '#f3f2ee', padding: '.6rem .9rem', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: '#4a4a52', borderBottom: '1px solid #e0dfd9' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[
                    ['1', 'Keyboard only', 'Tab through every interactive element. Is focus always visible? Can you reach and operate everything?'],
                    ['2', 'Screen reader (NVDA/VoiceOver)', 'Navigate by headings, landmarks, links. Do all images, buttons, and forms make sense?'],
                    ['3', '200% zoom', 'Zoom to 200% in browser. Does content reflow? Does anything overlap or disappear?'],
                    ['4', '1.5× text spacing', 'Apply text spacing bookmarklet. Check nothing breaks.'],
                    ['5', 'High contrast mode', 'Enable Windows High Contrast. Custom colours should not break content.'],
                    ['6', 'Mobile + switch', 'Test with iOS Switch Control or Android Switch Access.'],
                  ].map(([n, t, d]) => (
                    <tr key={n} style={{ borderBottom: '1px solid #e0dfd9' }}>
                      <td style={{ padding: '.65rem .9rem', color: '#4a4a52', fontWeight: 500 }}>{n}</td>
                      <td style={{ padding: '.65rem .9rem', color: '#18171a', fontWeight: 500 }}>{t}</td>
                      <td style={{ padding: '.65rem .9rem', color: '#3f3f46' }}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ── CTA ── */}
            <div style={{ background: 'linear-gradient(135deg,#e8eeff,#f0f3ff)', border: '1px solid #c7d3f5', borderRadius: 16, padding: '2rem', textAlign: 'center', marginTop: '2rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 600, color: '#18171a', marginBottom: '.5rem' }}>Scan your site for accessibility issues</h2>
              <p style={{ fontSize: 15, color: '#3f3f46', marginBottom: '1.25rem' }}>a11ytest.ai catches WCAG failures, generates fix suggestions, and integrates with your CI/CD pipeline.</p>
              <a href="/signup" style={{ display: 'inline-block', background: '#1746a2', color: '#fff', padding: '11px 28px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Get started →</a>
            </div>

          </main>
        </div>

        {/* Footer */}
        <footer style={{ background: '#f3f2ee', borderTop: '1px solid #e0dfd9', padding: '2rem', textAlign: 'center', fontSize: 13, color: '#3f3f46' }}>
          <p>
            <a href="https://a11ytest.ai" style={{ color: '#3f3f46' }}>a11ytest.ai</a> · Free accessibility resource ·{' '}
            <a href="https://www.w3.org/WAI/WCAG22/quickref/" target="_blank" rel="noopener noreferrer" style={{ color: '#3f3f46' }}>WCAG 2.2 Quick Ref</a> ·{' '}
            <a href="https://www.w3.org/WAI/ARIA/apg/" target="_blank" rel="noopener noreferrer" style={{ color: '#3f3f46' }}>ARIA Authoring Practices</a>
          </p>
          <p style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
            A11YTEST.AI LTD · Company no. 17070504
          </p>
        </footer>
      </div>
    </>
  )
}
