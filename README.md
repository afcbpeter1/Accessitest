# AccessScan - Accessibility Testing SaaS Platform

AccessScan is a modern web application that helps developers and businesses test their websites for accessibility compliance. The platform scans websites for WCAG 2.2 compliance (Level A, AA, AAA) and provides detailed reports with actionable recommendations.

## Features

### 🎯 Core Functionality
- **Website Scanning**: Crawl and analyze websites for accessibility issues
- **WCAG 2.2 Compliance**: Test against Web Content Accessibility Guidelines 2.2 (Level A, AA, AAA)
- **PDF Reports**: Generate comprehensive accessibility reports
- **Issue Tracking**: Monitor and track accessibility issues over time
- **Dashboard Analytics**: View scan statistics and progress

### 🔧 Technical Features
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Real-time Scanning**: Live scan progress and status updates
- **Multiple Scan Types**: Quick scans and comprehensive deep crawls
- **Subdomain Support**: Include or exclude subdomains from scans
- **Export Options**: Download reports in PDF, CSV, and JSON formats

### 💼 Business Features
- **Subscription Management**: Yearly and monthly subscription plans
- **User Management**: Account settings and user preferences
- **Notification System**: Email alerts for scan completion and critical issues
- **Team Collaboration**: Share reports and collaborate with team members

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form with Zod validation
- **Accessibility Testing**: Axe-core
- **Web Scraping**: Puppeteer
- **PDF Generation**: PDFKit
- **Database**: Neon (PostgreSQL) - planned

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd accessscan-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (for future implementation)
DATABASE_URL=your_neon_database_url

# Authentication (for future implementation)
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000

# Email (for future implementation)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

### Deployment (Railway, Render, etc.)

To avoid **"Failed to find Server Action"** errors after redeploys (e.g. `Failed to find Server Action "x"`), set a **persistent** Server Actions encryption key so all builds and instances use the same key:

```bash
# Generate once and set in your host's environment (e.g. Railway, Render)
openssl rand -base64 32
```

Add to your deployment environment:

```env
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<paste the generated key>
```

Set this at **build time** (not only at runtime) so the key is embedded consistently. If you still see the error, do a full redeploy after setting the variable and have users refresh the page to clear cached client code.

**Optional – PDF auto-fix:** Document scan works without it. To enable automatic PDF fixes (alt text, table summaries, etc.) on the server, install PyMuPDF in the same environment that runs the Node app (e.g. in a custom Dockerfile or Nixpacks setup): `pip install pymupdf`. If PyMuPDF is not installed, the UI will show a short message and you still get full scan results and AI suggestions.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard page
│   ├── history/           # Scan history page
│   ├── reports/           # Reports page
│   ├── settings/          # Settings page
│   └── new-scan/          # New scan page
├── components/            # Reusable components
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── ScanForm.tsx       # Scan configuration form
│   └── StatsCard.tsx      # Statistics display card
└── lib/                   # Utility functions (future)
```

## Usage

### Starting a New Scan

1. Navigate to the dashboard or "New Scan" page
2. Enter the website URL you want to scan
3. Configure scan options:
   - Include subdomains
   - Deep crawl (up to 100 pages)
   - Scan type (quick or full)
4. Click "Start Scan" to begin the accessibility analysis

### WCAG 2.2 Integration

The platform uses axe-core with WCAG 2.2 configuration:

```typescript
// Example of how axe-core is configured for WCAG 2.2 (A, AA, AAA)
axe.configure({
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa']
  },
  resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable']
})
```

Key WCAG 2.2 features tested:

**Level A (Basic Accessibility):**
- **Target Size (2.5.5)**: Interactive elements must be at least 24x24 CSS pixels
- **Focus Indicators (2.4.12)**: Visible focus indicators for all interactive elements
- **Page Titles**: Descriptive page titles for each page

**Level AA (Enhanced Accessibility):**
- **Color Contrast (1.4.3)**: Sufficient contrast ratios for text readability
- **Alt Text (1.1.1)**: Descriptive alt text for images
- **Form Labels (3.3.2)**: Proper labeling of form controls
- **Keyboard Navigation**: Full keyboard accessibility

**Level AAA (Maximum Accessibility):**
- **Enhanced Color Contrast**: Higher contrast ratios (7:1 for normal text)
- **Enhanced Focus Indicators**: More prominent focus indicators
- **Enhanced Keyboard Navigation**: Comprehensive keyboard support
- **Enhanced Text Alternatives**: More detailed alt text requirements
- **Enhanced Form Labels**: More descriptive form labels

### Viewing Results

- **Dashboard**: Overview of recent scans and statistics
- **Scan History**: Complete list of all scans with status
- **Reports**: Detailed accessibility reports with issue breakdowns
- **Settings**: Manage account, subscription, and preferences

### Understanding Issues

The platform categorizes accessibility issues by severity:

- **Critical**: Must be fixed immediately (WCAG A violations)
- **Serious**: Should be fixed soon (WCAG AA violations)
- **Moderate**: Good practice improvements (WCAG AAA violations)

Each issue includes:
- Detailed description
- WCAG guideline reference
- Step-by-step fix recommendations
- Affected pages

## Subscription Plans

### Free Trial
- 7-day free trial
- 3 scans per month
- Basic accessibility checks
- Email support

### Pro Plan ($99/year)
- Unlimited scans
- Deep crawl capabilities
- PDF reports
- Priority support
- Advanced analytics
- Team collaboration

### Monthly Plan ($12/month)
- Same features as Pro Plan
- Higher monthly cost for flexibility

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Code Style

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Future Enhancements

### Planned Features
- **Database Integration**: Neon PostgreSQL for data persistence
- **Authentication**: User registration and login
- **Email Notifications**: Automated email alerts
- **API Integration**: RESTful API for external integrations
- **Advanced Analytics**: Detailed accessibility metrics
- **Team Management**: Multi-user accounts and permissions
- **Custom Rules**: User-defined accessibility rules
- **Mobile App**: React Native mobile application

### Technical Improvements
- **Performance Optimization**: Caching and optimization
- **Security Enhancements**: Rate limiting, input validation
- **Testing**: Unit and integration tests
- **CI/CD**: Automated deployment pipeline
- **Monitoring**: Application performance monitoring

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: support@accessscan.com
- Documentation: [docs.accessscan.com](https://docs.accessscan.com)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)

## Acknowledgments

- [Axe-core](https://github.com/dequelabs/axe-core) for accessibility testing engine
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/) for accessibility guidelines
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
