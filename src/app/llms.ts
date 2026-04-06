import type { NextRequest } from 'next/server'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

export async function GET(_req: NextRequest) {
  const content = `# a11ytest.ai

> a11ytest.ai is an automated web accessibility scanning platform built for development teams. It combines axe-core, custom deterministic rules, and behavioural browser automation to detect WCAG 2.0, 2.1, and 2.2 failures, Section 508 issues, and EN 301 549 compliance gaps in a single scan. Detected issues are pushed directly into development backlogs via Jira and Azure DevOps integrations. The platform also scans PDF documents against PDF/UA (ISO 14289) and provides a browser extension with screen reader simulation.

## What a11ytest.ai does

a11ytest.ai runs layered accessibility scans combining:
- axe-core with WCAG 2.0/2.1/2.2 AA, Section 508, EN 301 549, and best-practice tag sets, plus additional rules enabled beyond default configurations
- Custom deterministic checks for issues axe-core does not cover by default, including iframe titles, focusable elements inside aria-hidden containers, duplicate IDs, unlabelled landmark regions, and missing fieldset/legend for grouped inputs
- Behavioural checks using a headless browser — skip link functionality, focus visibility, tab order, positive tabindex detection, and modal dialog focus management
- AI-assisted remediation suggestions on detected issues, providing developers with specific fix guidance

## Products and integrations

- Web scanner: ${baseUrl}
- CI/CD pipeline integration: Azure DevOps, GitHub Actions, GitLab CI
- Backlog integration: Jira, Azure DevOps
- Browser extension with ElevenLabs TTS screen reader simulation
- PDF/UA document scanning
- Logo contrast checker: ${baseUrl}/logo-contrast-checker
- Accessibility playground: ${baseUrl}/playground

## Accessibility Wiki

a11ytest.ai hosts a free, community-editable accessibility knowledge base covering WCAG criteria, common failures, accessible patterns, testing techniques, assistive technology, and legislation.

- Wiki home: ${baseUrl}/wiki
- Automated testing limitations: ${baseUrl}/wiki/automated-testing-limitations
- WCAG overview: ${baseUrl}/wiki/wcag-overview
- Common failures index: ${baseUrl}/wiki/category/common-failures

## Standards covered

- WCAG 2.0 Level A and AA
- WCAG 2.1 Level AA
- WCAG 2.2 Level AA
- Section 508 (US federal)
- EN 301 549 (European Accessibility Act)
- PDF/UA (ISO 14289)

## Company

A11YTEST.AI LTD is a UK-registered company based in Yorkshire, England.

## Pages

- [Home](${baseUrl}): Product overview and sign-up
- [Playground](${baseUrl}/playground): Free accessibility scan tool
- [Logo Contrast Checker](${baseUrl}/logo-contrast-checker): Free contrast ratio tool
- [Accessibility Wiki](${baseUrl}/wiki): Free community accessibility knowledge base
- [A11y Resources](${baseUrl}/a11y): Curated accessibility resources
- [Privacy Policy](${baseUrl}/privacy-policy)
- [Terms of Service](${baseUrl}/terms-of-service)
- [Accessibility Statement](${baseUrl}/accessibility-statement)
`

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}