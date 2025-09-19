# How to Set Up Periodic Scans

This guide shows you how to set up automatic, recurring accessibility scans for your websites.

## 🚀 Quick Setup

### Step 1: Run Database Migration
First, you need to set up the database table for periodic scans:

```bash
node scripts/run-periodic-scans-migration.js
```

### Step 2: Create Your First Periodic Scan

1. **Go to Scan History**
   - Navigate to `/scan-history` in your browser
   - You'll see two tabs: "Scan History" and "Periodic Scans"

2. **Find a Previous Scan**
   - In the "Scan History" tab, find any scan you want to repeat automatically
   - Look for the purple "Schedule" button next to each scan

3. **Click "Schedule"**
   - Click the purple "Schedule" button on the scan you want to repeat
   - A modal will pop up with scheduling options

4. **Choose Your Settings**
   - **Frequency**: Select Daily, Weekly, or Monthly
   - **Scan Title**: Give your periodic scan a descriptive name
   - Click "Schedule Scan"

### Step 3: Manage Your Periodic Scans

1. **Switch to "Periodic Scans" Tab**
   - Click on the "Periodic Scans" tab to see all your scheduled scans

2. **View Scheduled Scans**
   - See all your scheduled scans with:
     - Frequency (Daily/Weekly/Monthly)
     - Next run time
     - Status (Active/Paused)
     - Last run time

3. **Manage Individual Scans**
   - **Pause/Resume**: Click the "Pause" or "Resume" button
   - **Delete**: Click "Delete" to remove a scheduled scan

## 📋 What Gets Scheduled

When you schedule a scan, the system saves:
- **All scan settings** (WCAG level, selected tags, etc.)
- **Pages to scan** (the exact pages you selected)
- **URL and configuration** (everything needed to rerun the scan)

## 🔄 How It Works

1. **Automatic Execution**: Scans run automatically based on your schedule
2. **Same Settings**: Each run uses the exact same settings as the original scan
3. **Results Storage**: Results are saved to your scan history just like manual scans
4. **Credit Usage**: Each scheduled scan run consumes credits like a normal scan

## 💡 Best Practices

### For Daily Scans
- **High-traffic websites** that change frequently
- **E-commerce sites** with regular content updates
- **News sites** with daily content

### For Weekly Scans
- **Corporate websites** with regular updates
- **Blog sites** with weekly content
- **Portfolio sites** with periodic updates

### For Monthly Scans
- **Static websites** that rarely change
- **Documentation sites** with infrequent updates
- **Long-term monitoring** of compliance

## 🎯 Example Use Cases

### E-commerce Site
```
Scan: "Homepage and Product Pages"
Frequency: Daily
Pages: Homepage, Product listing, Checkout flow
WCAG Level: AA
```

### Corporate Website
```
Scan: "Main Pages Compliance Check"
Frequency: Weekly
Pages: Homepage, About, Contact, Services
WCAG Level: AA
```

### Blog Site
```
Scan: "Content Accessibility"
Frequency: Weekly
Pages: Homepage, Blog listing, Recent posts
WCAG Level: AA
```

## ⚠️ Important Notes

1. **Credits Required**: Each scheduled scan run consumes credits
2. **Manual Triggering**: Currently, scans need to be manually triggered (background processing coming soon)
3. **Document Scans**: Document scans cannot be automatically scheduled (requires file upload)
4. **Subdomain Settings**: The "Include Subdomains" setting is preserved from the original scan

## 🔧 Troubleshooting

### "No scheduled scans" Message
- Make sure you've run the database migration
- Check that you've created at least one periodic scan

### Scan Not Running
- Verify the scan is marked as "Active"
- Check that you have sufficient credits
- Ensure the original scan settings are still valid

### Can't Find "Schedule" Button
- Make sure you're in the "Scan History" tab
- Only completed scans can be scheduled
- Check that the scan has valid settings

## 🚀 Next Steps

Once you have periodic scans set up:
1. **Monitor Results**: Check your scan history regularly
2. **Adjust Frequency**: Change frequency based on your needs
3. **Add More Scans**: Schedule scans for different parts of your website
4. **Track Progress**: Use the results to improve accessibility over time

## 📞 Need Help?

If you run into issues:
1. Check the browser console for error messages
2. Verify the database migration completed successfully
3. Ensure you have sufficient credits for scheduled scans
4. Contact support if problems persist
