# Periodic Scans and Rerun Features

This document describes the new features added to the accessibility scanning system: the ability to rerun previous scans and schedule periodic scans.

## 🚀 New Features

### 1. Rerun Previous Scans
- **One-click rerun**: Users can rerun any previous scan with the same settings
- **Automatic settings extraction**: Scan settings are automatically extracted from previous scans
- **Credit management**: Rerun scans consume credits just like new scans
- **Smart handling**: Different behavior for web vs document scans

### 2. Periodic Scan Scheduling
- **Flexible scheduling**: Daily, weekly, or monthly scan schedules
- **Automatic execution**: Scans run automatically based on the schedule
- **Settings preservation**: All original scan settings are preserved
- **Status management**: Pause/resume scheduled scans
- **Next run tracking**: Clear indication of when the next scan will run

## 📁 Files Added/Modified

### Database Schema
- `scripts/create-periodic-scans-table.sql` - Database table for periodic scans
- `scripts/run-periodic-scans-migration.js` - Migration script

### API Endpoints
- `src/app/api/periodic-scans/route.ts` - CRUD operations for periodic scans
- `src/app/api/rerun-scan/route.ts` - Rerun previous scans

### UI Components
- `src/app/scan-history/page.tsx` - Updated with tabs and new functionality

## 🗄️ Database Schema

### periodic_scans Table
```sql
CREATE TABLE periodic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
    scan_title VARCHAR(255) NOT NULL,
    url VARCHAR(500), -- For web scans
    file_name VARCHAR(255), -- For document scans
    file_type VARCHAR(50), -- For document scans
    scan_settings JSONB NOT NULL, -- Complete scan configuration
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_scan_id UUID REFERENCES scan_history(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 API Endpoints

### Periodic Scans API (`/api/periodic-scans`)

#### GET - List periodic scans
```javascript
// Response
{
  "success": true,
  "scans": [
    {
      "id": "uuid",
      "scanType": "web",
      "scanTitle": "My Website Scan",
      "url": "https://example.com",
      "frequency": "weekly",
      "nextRunAt": "2024-01-15T10:00:00Z",
      "isActive": true,
      // ... other fields
    }
  ]
}
```

#### POST - Create periodic scan
```javascript
// Request
{
  "scanType": "web",
  "scanTitle": "My Website Scan",
  "url": "https://example.com",
  "scanSettings": {
    "pagesToScan": ["https://example.com", "https://example.com/about"],
    "includeSubdomains": false,
    "wcagLevel": "AA",
    "selectedTags": ["wcag22a", "wcag22aa"]
  },
  "frequency": "weekly"
}
```

#### PUT - Update periodic scan
```javascript
// Request
{
  "scanId": "uuid",
  "isActive": false, // Optional: pause/resume
  "frequency": "monthly" // Optional: change frequency
}
```

#### DELETE - Delete periodic scan
```javascript
// Request
{
  "scanId": "uuid"
}
```

### Rerun Scan API (`/api/rerun-scan`)

#### POST - Rerun a previous scan
```javascript
// Request
{
  "scanId": "uuid"
}

// Response (Web Scan)
{
  "success": true,
  "scanId": "new_scan_id",
  "message": "Scan rerun initiated successfully",
  "scanResult": { /* scan results */ }
}

// Response (Document Scan)
{
  "success": true,
  "scanId": "new_scan_id",
  "message": "Document scan settings retrieved. Please upload the document again.",
  "originalSettings": {
    "scanTitle": "My Document Scan",
    "scanSettings": { /* original settings */ }
  }
}
```

## 🎨 UI Features

### Scan History Page Updates
- **Tabbed interface**: Separate tabs for "Scan History" and "Periodic Scans"
- **Rerun button**: Green "Rerun" button on each scan in history
- **Schedule button**: Purple "Schedule" button to create periodic scans
- **Periodic scans management**: View, pause, resume, and delete scheduled scans

### New UI Elements
- **Frequency indicators**: Clear display of scan frequency (Daily/Weekly/Monthly)
- **Next run time**: Shows when the next scan will execute
- **Status badges**: Active/Paused status for scheduled scans
- **Modal for scheduling**: Simple form to create new periodic scans

## 🚀 Getting Started

### 1. Run Database Migration
```bash
node scripts/run-periodic-scans-migration.js
```

### 2. Test the Features
1. Go to the Scan History page
2. Click "Rerun" on any previous scan to rerun it
3. Click "Schedule" to create a periodic scan
4. Switch to the "Periodic Scans" tab to manage scheduled scans

## 🔮 Future Enhancements

### Planned Features
- **Email notifications**: Notify users when periodic scans complete
- **Scan comparison**: Compare results between periodic scan runs
- **Advanced scheduling**: Custom schedules (e.g., weekdays only)
- **Bulk operations**: Schedule multiple scans at once
- **Scan templates**: Save and reuse scan configurations

### Technical Improvements
- **Background job processing**: Use a proper job queue for periodic scans
- **Webhook support**: Notify external systems when scans complete
- **API rate limiting**: Prevent abuse of rerun functionality
- **Scan result archiving**: Automatic cleanup of old scan results

## 🐛 Known Limitations

1. **Document scans**: Cannot automatically rerun document scans (requires manual file upload)
2. **Background processing**: Periodic scans currently require manual triggering
3. **Time zone handling**: Next run times use server timezone
4. **Concurrent scans**: No limit on simultaneous periodic scans per user

## 🔒 Security Considerations

- **User isolation**: All operations are scoped to the authenticated user
- **Credit validation**: Rerun scans properly validate and deduct credits
- **Input validation**: All API endpoints validate input parameters
- **SQL injection protection**: Using parameterized queries throughout

## 📊 Performance Considerations

- **Database indexes**: Proper indexes on user_id, next_run_at, and is_active
- **JSON storage**: Scan settings stored as JSONB for efficient querying
- **Batch operations**: Periodic scan execution can be batched for efficiency
- **Cleanup policies**: Consider implementing automatic cleanup of old periodic scans
