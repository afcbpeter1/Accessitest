/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; label: string; cta?: boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/a11y', label: 'A11y Resource' },
  { href: '/accessibility-issues', label: 'Issues Demo' },
  { href: '/logo-contrast-checker', label: 'Logo Checker' },
  { href: '/playground', label: 'Playground' },
  { href: '/signup', label: 'Get started →', cta: true }
]

export default function ToolingTopNav() {
  const rawPathname = usePathname() || ''
  const pathname = rawPathname !== '/' ? rawPathname.replace(/\/+$/, '') : rawPathname
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.cta) return true
    const href = item.href !== '/' ? item.href.replace(/\/+$/, '') : item.href
    return href !== pathname
  })

  return (
    <nav
      role="navigation"
      aria-label="Site navigation"
      className="tooling-topnav sticky top-0 z-[100] h-[60px] border-b border-gray-200 bg-white/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center gap-2" aria-label="a11ytest.ai home">
          <img
            src="/allytest.png"
            alt="a11ytest.ai"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <ul className="hidden items-center gap-2 sm:flex" role="list" aria-label="Top navigation">
          {visibleItems.map((item) => {
            const isActive = !item.cta && pathname === item.href
            if (item.cta) {
              return (
                <li key={item.href} role="listitem">
                  <Link
                    href={item.href}
                    className="rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#081a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              )
            }

            return (
              <li key={item.href} role="listitem">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'rounded-lg px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-sky-50 text-[#0B1220]'
                      : 'text-gray-900 hover:bg-sky-50 hover:text-[#0B1220]'
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Mobile: show only CTA to keep header compact */}
        <div className="sm:hidden">
          <Link
            href="/signup"
            className="rounded-lg bg-[#0B1220] px-3 py-2 text-sm font-extrabold text-white hover:bg-[#081a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2"
          >
            Get started →
          </Link>
        </div>
      </div>
    </nav>
  )
}

