import { NextRequest, NextResponse } from 'next/server'
import { getLaunchOptionsForServerAsync } from '@/lib/puppeteer-config'

const puppeteer = process.platform === 'linux' ? require('puppeteer-core') : require('puppeteer')

export async function GET() {
  try {
    const browser = await puppeteer.launch(await getLaunchOptionsForServerAsync({
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    }))

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
