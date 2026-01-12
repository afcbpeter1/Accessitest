import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export async function GET() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    })

    try {
      const page = await browser.newPage()
      
      // Test with a simple, reliable site
      await page.goto('https://example.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      })
      
      const title = await page.title()
      return NextResponse.json({
        success: true,
        message: 'Puppeteer is working',
        title: title
      })
      
    } finally {
      await browser.close()
    }
    
  } catch (error) {
    console.error('Puppeteer test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
