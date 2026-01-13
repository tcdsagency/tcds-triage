# TCDS Insurance Operations Platform
## User Tutorial Guide

Welcome to the TCDS Insurance Operations Platform! This guide will help you navigate and use all the features available to make your work faster and easier. Whether you're answering phones, creating quotes, or managing the team, this guide has you covered.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Call & Message Management](#3-call--message-management)
   - [Pending Review](#31-pending-review)
   - [Calls](#32-calls)
   - [Messages](#33-messages)
   - [After-Hours Queue](#34-after-hours-queue)
   - [Leads Queue](#35-leads-queue)
   - [Supervisor Dashboard](#36-supervisor-dashboard)
4. [Customer Management](#4-customer-management)
   - [Customers](#41-customers)
   - [Customer Profile](#42-customer-profile)
   - [Birthday Cards](#43-birthday-cards)
   - [Policy Notices](#44-policy-notices)
   - [Policy Change Requests](#45-policy-change-requests)
5. [Quote Workflows](#5-quote-workflows)
   - [New Quote](#51-new-quote)
   - [Quotes Management](#52-quotes-management)
   - [Quote Extractor](#53-quote-extractor)
   - [Canopy Connect](#54-canopy-connect)
6. [Property & Risk Tools](#6-property--risk-tools)
   - [Properties Lookup](#61-properties-lookup)
   - [Risk Monitor](#62-risk-monitor)
   - [Mortgagee Payments](#63-mortgagee-payments)
7. [Payment & Service Tools](#7-payment--service-tools)
   - [ID Cards](#71-id-cards)
   - [Payment Advance](#72-payment-advance)
   - [Same-Day Payment](#73-same-day-payment)
   - [Invoice / DEC Extractor](#74-invoice--dec-extractor)
8. [Analytics & Reports](#8-analytics--reports)
   - [Reports Dashboard](#81-reports-dashboard)
   - [Google Reviews](#82-google-reviews)
9. [AI-Powered Features](#9-ai-powered-features)
   - [AI Tasks](#91-ai-tasks)
   - [Training Modules](#92-training-modules)
10. [Administration](#10-administration)
    - [Agency Settings](#101-agency-settings)
    - [My Settings](#102-my-settings)

---

## 1. Getting Started

### Logging In

1. Open your web browser and go to the TCDS system URL
2. Click **Sign In** on the landing page
3. Enter your email and password
4. You'll be taken to your personalized dashboard based on your role

### Understanding User Roles

The system has flexible user roles with feature-based permissions:

| Role | Description | Key Features |
|------|-------------|--------------|
| **Admin** | Managers with full system access | All features plus user management and settings |
| **Intake** | Call center staff handling incoming calls | Pending review, Calls, Messages, ID Cards, After-hours |
| **Producer** | Licensed agents who create quotes and close sales | Quotes, Properties, Canopy Connect, Risk Monitor |

### Navigating the System

The left sidebar shows all available features organized into sections:

- **Dashboard** - Your home base with quick actions
- **Intake & Reception** - Call handling, leads, messages
- **Customers** - Customer management and service tools
- **Tools & Resources** - Quotes, properties, risk monitoring
- **Settings** - Personal and agency configuration

**Tip:** Look for badges on menu items—they show items needing your attention!

---

## 2. Dashboard Overview

The Dashboard is your home screen when you log in. It gives you a quick snapshot of your work.

### What You'll See

- **Customer Search** - A search bar to quickly find any customer or lead by name or phone number
- **Quick Quote Buttons** - Start quotes for Auto, Home, Bundle, Boat/RV, or Business
- **Quick Links** - Jump to Pending Review, Leads, Calls, or Customers

### How to Search for a Customer

1. Type a customer's name OR phone number in the search bar
2. Results appear automatically as you type
3. Click on a result to see their full profile with:
   - Contact information
   - Policy details
   - Recent notes
   - Call history

**Tip:** Phone number searches work with or without dashes—just type the digits!

### Smart Action Engine

When you select a customer, the system shows AI-suggested actions:
- **Quote** - Start a new quote for this customer
- **Service Request** - Create a service ticket
- **Policy Review** - Review their current coverage

---

## 3. Call & Message Management

This section covers all the tools for handling phone calls, messages, and leads.

### 3.1 Pending Review

**What it does:** Shows calls and messages that need attention, with options to review, match customers, and take action.

**Who uses it:** Intake staff and managers

**How to access it:** Click **Pending Review** in the sidebar

**Two Main Tabs:**

**Pending Tab:**
- Shows items waiting for review
- Filter by status: All, Matched, Needs Review, Unmatched, After Hours
- Filter by type: All, Wrapup (calls), Message (SMS)

**Reviewed Tab:**
- Shows completed items (notes posted, service requests created, voided)
- Filter by: All, Reviewed, Auto-Voided
- Re-submit items for review if needed

**Understanding Status Badges:**

| Badge | Color | Meaning |
|-------|-------|---------|
| Matched | Green | Customer identified, ready to process |
| Needs Review | Blue | Multiple matches found, needs selection |
| Unmatched | Amber | No customer match, needs manual lookup |
| After Hours | Purple | Received outside business hours |

**Working Through Pending Items:**

1. Each item shows:
   - Caller phone number and name (if matched)
   - Call direction (inbound/outbound arrow)
   - AI summary of the interaction
   - Customer sentiment indicator
   - Call ID for reference (click to copy)
   - Trestle identity hint for unmatched callers

2. **Action Buttons:**
   - **Review & Post** - Open review modal to edit and post note
   - **Find Match** - Search for the correct customer
   - **Post Note** - Quick post to AgencyZoom
   - **Create SR** - Create a service request
   - **NCM Queue** - Post to No Customer Match queue
   - **Void** - Remove without action
   - **Open in AgencyZoom** - View customer in AZ

**Matching an Unmatched Call:**

1. Click **Find Match** on the item
2. Search by name or phone number
3. Select the correct customer from results
4. The call is linked and ready to process

**Reviewing Completed Items:**

1. Switch to the **Reviewed** tab
2. Filter by All, Reviewed, or Auto-Voided
3. Each item shows:
   - Outcome (Note Posted, Service Request, Voided, Auto-Voided)
   - Reviewer name and timestamp
   - Auto-void reason if applicable
4. Click **Re-submit for Review** to send back to pending queue

**Alert System:**
If enabled, an audio alert plays when items wait longer than 90 seconds.

---

### 3.2 Calls

**What it does:** Shows complete call history with recordings, transcripts, and analytics.

**Who uses it:** All staff

**How to access it:** Click **Calls** in the sidebar

**Understanding the Call List:**

The top shows quick stats:
- **Total Calls** - All calls in the period
- **Answered** - Successfully connected calls
- **Missed** - Unanswered calls
- **Avg Duration** - Average call length

**Filtering Options:**
- Date range picker
- Direction: All, Inbound, Outbound
- Status: All, Answered, Missed, Voicemail
- Agent filter

**Call Details:**

Click on any call to see:
- **Recording playback** with position tracking
- **Call summary** - AI-generated synopsis
- **Sentiment analysis** - Customer mood (positive/neutral/negative)
- **QA score** - Quality assessment
- **Full transcript** - Expandable conversation text
- **Call back button** - Quick return call

**Tip:** Use call recordings for training and quality assurance!

---

### 3.3 Messages

**What it does:** Manages SMS conversations with customers, grouped by contact.

**Who uses it:** Intake staff

**How to access it:** Click **Messages** in the sidebar

**How to Use:**

1. **Left Panel:** List of conversations grouped by phone number
   - Search conversations by name or number
   - Unread message indicators
   - Last message preview

2. **Right Panel:** Full message thread
   - Customer messages on left (gray)
   - Agent messages on right (green)
   - Auto-replies marked with robot icon (purple)

3. **Sending Messages:**
   - Type in the text box at the bottom
   - Click **Send** or press Enter
   - Quick reply templates available

**Message Status:**
- Sent - Message delivered successfully
- Failed - Check phone number validity

**Acknowledging Messages:**
Click the checkmark to acknowledge reviewed messages and remove from unread queue.

---

### 3.4 After-Hours Queue

**What it does:** Manages calls and messages received outside business hours.

**Who uses it:** Intake staff

**How to access it:** Click **After-Hours** in the sidebar

**What Shows Up Here:**
- Calls and messages received outside Mon-Fri 9am-6pm CST
- Answering service transcripts
- Voicemails with transcription

**Priority Indicators:**
- **Urgent** (red) - Keywords like "claim" or "accident" detected
- **Normal** (gray) - Standard after-hours contact

**Working Through Items:**
1. Review AI-generated summary
2. Match to customer if unmatched
3. Assign to an agent for follow-up
4. Mark complete when handled

---

### 3.5 Leads Queue

**What it does:** Manages incoming leads from multiple sources with automatic assignment.

**Who uses it:** Intake staff and Producers

**How to access it:** Click **Leads** in the sidebar

**Lead Sources:**
- Call-in leads
- Webform submissions
- Website inquiries
- Lead vendors
- Email leads
- Referrals

**Lead Statuses:**
- **Queued** - New lead waiting for assignment
- **Notified** - Agent has been notified
- **Escalated** - Unclaimed, escalated to all agents
- **Claimed** - Agent is working the lead
- **Converted** - Lead became a customer
- **Expired** - Lead timed out

**Working a Lead:**

1. New leads appear at the top of the queue
2. Click **Claim** to take ownership
3. Contact the lead and take notes
4. Update status as you progress
5. Convert when they become a customer

**Tip:** Respond quickly—leads contacted within 5 minutes are 21x more likely to convert!

---

### 3.6 Supervisor Dashboard

**What it does:** Real-time monitoring of agent activity and call status.

**Who uses it:** Managers/Supervisors

**How to access it:** Click **Supervisor** in the sidebar

**What You'll See:**
- **Active Calls** - Live view of current calls with duration
- **Agent Status** - Who's available, on call, or away
- **Call List by Agent** - Individual agent activity

**Supervisor Controls:**
- Monitor agent calls in real-time
- View call details and duration
- Track team performance

---

## 4. Customer Management

### 4.1 Customers

**What it does:** Search and browse customer database with detailed information.

**Who uses it:** All staff

**How to access it:** Click **Customers** in the sidebar

**Customer Search:**
- Search by name, phone, or email
- Filter by policy type
- Bulk selection for actions

**Customer Card Display:**
- Contact information (phone, email)
- Policy list with carriers and coverage types
- Property information (address, year built, sq ft)
- Roof condition from Nearmap imagery
- Hazard exposure (wind, hail, flood, fire, earthquake)

**Policy Type Badges:**
- Auto, Home, Umbrella, RV, Boat, Commercial, etc.
- Color-coded by type

---

### 4.2 Customer Profile

**What it does:** Complete customer view with all details and interaction history.

**How to access it:** Click on any customer name throughout the app

**Profile Tabs:**

**Overview:**
- Contact information
- Quick stats
- Coverage summary
- Recent activity

**Policies:**
- All active and inactive policies
- Carrier and policy numbers
- Coverage limits and deductibles
- Premium amounts
- Vehicles and drivers (for auto)

**Vehicles:**
- All vehicles across policies
- Year, make, model, VIN
- Coverage details per vehicle
- Lienholder information

**Drivers:**
- All household drivers
- License information
- Points and violations

**Properties:**
- Property addresses
- Home details (beds, baths, sq ft)
- Construction information
- Hazard exposure

**Claims:**
- Claims history
- Status and amounts
- Dates and descriptions

**Notes:**
- All AgencyZoom notes
- Call summaries
- Service request history

**Deep Think (AI):**
- AI-powered customer insights
- Historical interaction analysis
- Suggested actions

---

### 4.3 Birthday Cards

**What it does:** Sends birthday greetings to customers via email or text.

**Who uses it:** All staff

**How to access it:** Click **Birthday Cards** in the sidebar

**Features:**
- Upcoming birthday calendar
- Card preview carousel (multiple designs)
- Email and SMS delivery options
- Sent history tracking

**Sending Birthday Cards:**
1. View upcoming birthdays
2. Select card design
3. Choose delivery method (email/SMS)
4. Send with one click

---

### 4.4 Policy Notices

**What it does:** Manages incoming policy notices requiring action.

**Who uses it:** Intake staff

**How to access it:** Click **Policy Notices** in the sidebar

**Notice Statuses:**
- **Pending** - New notice awaiting review
- **Assigned** - Assigned to team member
- **Reviewed** - Reviewed but needs action
- **Flagged** - Requires attention
- **Actioned** - Complete

**Working Notices:**
1. Review notice content
2. Assign to appropriate team member
3. Take required action
4. Mark as complete

---

### 4.5 Policy Change Requests

**What it does:** Multi-step wizard for processing policy modifications.

**Who uses it:** Intake staff and Producers

**How to access it:** Click **Policy Change** in the sidebar

**Supported Change Types:**
- Add/Remove/Replace Vehicle
- Add/Remove Driver
- Change Coverage
- Update Mortgagee
- Update Lienholder
- Change Address

**The Change Process:**

**Step 1: Find the Policy**
- Search by customer phone
- Select the customer
- Choose the policy to modify

**Step 2: Select Change Type**
- Check the changes being requested
- Form adapts based on selection

**Step 3: Complete Details**
- For vehicle changes: VIN decode, coverage selection
- For driver changes: License info, relationship
- For mortgagee: Search database, copy clause

**Step 4: Review & Submit**
- Review all changes
- Add special instructions
- Submit for processing

---

## 5. Quote Workflows

### 5.1 New Quote

**What it does:** Create new insurance quotes with a step-by-step wizard.

**Who uses it:** Producers and Intake staff

**How to access it:** Click **New Quote** button or **Quotes > New Quote** in sidebar

**Quick Quote Types:**
- **Auto** - Personal auto insurance
- **Home** - Homeowners insurance
- **Bundle** - Auto + Home package
- **Boat/RV** - Recreational vehicles
- **Business** - Commercial insurance

**The Quote Process:**

1. Select insurance type(s)
2. Enter customer information
3. Add property/vehicle details
4. Select coverage preferences
5. Review and submit

---

### 5.2 Quotes Management

**What it does:** Track and manage all quote requests.

**Who uses it:** Producers and managers

**How to access it:** Click **Quotes** in the sidebar

**Quote Statuses:**
- **Draft** - Quote started but not complete
- **Submitted** - Sent to carriers
- **Quoted** - Received carrier quotes
- **Presented** - Shown to customer
- **Accepted** - Customer accepted
- **Declined** - Customer declined
- **Expired** - Quote expired

**Filtering & Search:**
- Filter by status
- Filter by type (Auto, Home, etc.)
- Search by customer name

**Quote Statistics:**
Dashboard showing quotes by status with counts

---

### 5.3 Quote Extractor

**What it does:** AI-powered extraction of quote details from carrier PDFs.

**Who uses it:** Producers

**How to access it:** Click **Quote Extractor** in the sidebar

**Two Import Methods:**

**Upload PDF:**
1. Click the Upload tab
2. Drag and drop PDF files
3. AI extracts: customer, carrier, premium, coverages

**Email Import:**
1. Click the Email Import tab
2. Forward carrier quote emails to the special address
3. PDFs automatically appear for processing

**After Extraction:**
- Review extracted data
- Match to customer/lead
- Post to AgencyZoom
- Track status: Extracted, Posted, Error

---

### 5.4 Canopy Connect

**What it does:** Send customers a link to share their current insurance information.

**Who uses it:** Producers and Intake staff

**How to access it:** Click **Canopy Connect** in the sidebar

**How It Works:**

1. Customer receives SMS with secure link
2. They log into their current carrier
3. Canopy pulls all policy data automatically
4. You receive complete insurance history

**What You Get:**
- Policy declarations
- ID cards
- Coverage details
- Vehicle/property information
- Claims history

**Dashboard Stats:**
- **Total** - All Canopy sessions
- **Synced** - Matched to AgencyZoom
- **Failed** - Sync problems
- **Needs Review** - Awaiting match

**Tip:** Send Canopy links during quote intake to save 10+ minutes of data entry!

---

## 6. Property & Risk Tools

### 6.1 Properties Lookup

**What it does:** Property analysis with aerial imagery, hazard data, and AI insights.

**Who uses it:** Producers

**How to access it:** Click **Properties** in the sidebar

**How to Look Up a Property:**

1. Type an address in the search box
2. Select from suggestions
3. Click Search

**What You'll See:**

**Nearmap Aerial Imagery:**
- High-resolution aerial photos
- AI-detected features:
  - Roof type and condition
  - Pool presence
  - Solar panels
  - Trampolines
  - Tree coverage
  - Outbuildings

**Property Details:**
- Bedrooms, bathrooms, square footage
- Year built
- Construction type
- Roof information

**Hazard Exposure:**
- Wind risk
- Hail risk
- Flood zone
- Fire risk
- Earthquake risk

**RPR Data:**
- Owner information
- Sale history
- Flood zone designation

**MMI Data:**
- Market data
- Listing history
- Mortgage information

**AI Property Analysis:**
- Risk assessment summary
- Underwriting concerns
- Coverage recommendations

**Export Options:**
- Download PDF report
- Email to underwriter

---

### 6.2 Risk Monitor

**What it does:** Monitors home policies and alerts when properties are listed for sale.

**Who uses it:** Producers and managers

**How to access it:** Click **Risk Monitor** in the sidebar

**Why It Matters:**
When customers sell, they often:
- Need a new home policy at the new address
- Cancel their current policy
- Are great prospects for new quotes

**Dashboard Stats:**
- **Total Policies** - Home policies monitored
- **Active Alerts** - Properties with listing activity
- **Properties Listed** - Currently on market
- **Properties Sold** - Recently sold (retention risk)

**Alert Types:**
- **Listed** (orange) - Property is on the market
- **Pending** (yellow) - Sale is pending
- **Sold** (red) - Property has sold

**Working an Alert:**

1. Click on an alert to see details
2. Review listing information:
   - Listing price and days on market
   - Customer contact info
3. Take action:
   - Assign to yourself
   - Acknowledge
   - Resolve with notes

**Tabs:**
- **Alerts** - Active listing alerts
- **Policies** - All monitored policies
- **Activity Events** - System activity log

**Syncing Policies:**
Click **Sync Policies** to import latest from AgencyZoom

---

### 6.3 Mortgagee Payments

**What it does:** Tracks mortgagee payment compliance and lapse detection.

**Who uses it:** Intake staff

**How to access it:** Click **Mortgagee Payments** in the sidebar

**Status Tracking:**
- **Active** - Payment current
- **Pending** - Payment due
- **Late** - Payment overdue
- **Lapsed** - Policy lapsed

**Dashboard Stats:**
- Last 24-hour activity
- Last 7-day activity
- Lapse detection count

**Check History:**
View all compliance checks with results

---

## 7. Payment & Service Tools

### 7.1 ID Cards

**What it does:** Generate and send insurance ID cards to customers.

**Who uses it:** Intake staff

**How to access it:** Click **ID Cards** in the sidebar

**How to Generate:**

1. **Search for Customer:**
   - Type name or phone
   - Select from results

2. **Select Policy:**
   - Choose active auto policy
   - Review vehicle information

3. **Generate Cards:**
   - Click Generate ID Cards
   - PDF created for all vehicles

4. **Deliver:**
   - Download PDF
   - Email to customer
   - Send via SMS

**Recent History:**
View recently generated cards for reference

---

### 7.2 Payment Advance

**What it does:** Process payment advance requests for customers.

**Who uses it:** Intake staff and Producers

**How to access it:** Click **Payment Advance** in the sidebar

**How to Request:**
1. Search for customer
2. Enter advance amount
3. Select payment method (ACH or Credit Card)
4. Submit request

**Request History:**
- View previous requests
- Track status (Pending, Processed, Declined)

---

### 7.3 Same-Day Payment

**What it does:** Process premium payments for same-day coverage.

**Who uses it:** Intake staff

**How to access it:** Click **Same-Day Payment** in the sidebar

**Features:**
- Customer search by phone/email
- Payment status tracking
- Historical payment view
- Quick payment entry

---

### 7.4 Invoice / DEC Extractor

**What it does:** Extract policy details from DEC pages and invoices.

**Who uses it:** Producers

**How to access it:** Click **Invoice** in the sidebar

**Features:**
- Upload DEC pages or invoices
- AI extracts policy details
- Email delivery capability
- Document management

---

## 8. Analytics & Reports

### 8.1 Reports Dashboard

**What it does:** Comprehensive analytics with multiple report views.

**Who uses it:** Managers

**How to access it:** Click **Reports** in the sidebar

**Key Metrics:**
- Total revenue
- New policies
- Renewals
- Cancellations

**Date Range Filters:**
- Today
- 7 days
- 30 days
- 90 days
- Year to date
- Custom range

**Report Tabs:**

**Overview:**
- KPI summary
- Trend charts

**By Agent:**
- Agent performance metrics
- Calls handled
- Quotes created
- Policies written

**By Carrier:**
- Portfolio analysis by carrier
- Premium distribution

**By Call:**
- Call volume trends
- Peak call times
- Average handle time
- Sentiment analysis

**By Policy:**
- Policy type breakdown
- New vs renewal

---

### 8.2 Google Reviews

**What it does:** Manage Google Reviews and send review requests.

**Who uses it:** All staff

**How to access it:** Click **Reviews** in the sidebar

**Review Statuses:**
- **Pending** - Request sent, awaiting response
- **Sent** - Review request delivered
- **Accepted** - Customer left a review
- **Declined** - Customer declined
- **Banned** - Customer blocked from requests

**Features:**
- Import reviews from Google
- Send review requests
- Track review statistics
- View review history

---

## 9. AI-Powered Features

### 9.1 AI Tasks

**What it does:** AI-generated daily task recommendations based on customer data.

**Who uses it:** Producers and Intake staff

**How to access it:** Click **AI Tasks** in the sidebar

**Task Types:**
- **Outreach** - Customer contact suggestions
- **Upsell** - Cross-sell opportunities
- **Renewal** - Upcoming renewal reminders
- **Service** - Service follow-ups

**Priority Levels:**
- **Urgent** - Handle immediately
- **High** - Handle today
- **Medium** - Handle this week
- **Low** - Handle when possible

**Task Details:**
- Estimated duration
- Expected outcome
- Preparation script
- Customer context

---

### 9.2 Training Modules

**What it does:** Interactive training with modules, quizzes, and simulations.

**Who uses it:** All staff

**How to access it:** Click **Training** in the sidebar

**Module Types:**
- **Video** - Watch and learn
- **Interactive** - Hands-on exercises
- **Quiz** - Knowledge check
- **Simulation** - Practice scenarios

**Features:**
- XP reward system
- Completion tracking
- Progress display

---

## 10. Administration

### 10.1 Agency Settings

**What it does:** Configure agency-wide settings and manage team.

**Who uses it:** Admins only

**How to access it:** Click **Agency Settings** in the sidebar

**Sections:**

**Team Management:**
- Add/edit/delete users
- Assign roles
- Set feature permissions per user

**Integrations:**
- AgencyZoom configuration
- Hawksoft sync settings
- Outlook integration
- 3CX phone system
- API key management

**Configuration:**
- Webhook settings
- SMS templates
- Business hours
- Notification preferences

---

### 10.2 My Settings

**What it does:** Personal profile and preference management.

**Who uses it:** All staff

**How to access it:** Click **My Settings** in the sidebar

**Options:**

**Profile:**
- Update name and email
- Change password

**Preferences:**
- Theme (Light/Dark mode)
- Notification settings

**Security:**
- Two-factor authentication setup
- Session management

**Contact:**
- Phone number
- Extension

---

## Quick Reference Card

### Common Tasks

| Task | Where to Go |
|------|-------------|
| Look up a customer | Dashboard search bar |
| Start a new quote | Dashboard > New Quote button |
| Send an ID card | ID Cards page |
| Text a customer | Messages page |
| Check property details | Properties page |
| Review pending calls | Pending Review page |
| See call history | Calls page |
| Manage leads | Leads page |
| Check risk alerts | Risk Monitor page |
| Generate reports | Reports page |
| Process payment | Same-Day Payment page |

### Understanding Status Colors

| Color | Meaning |
|-------|---------|
| Green | Good/Matched/Complete |
| Blue | In Progress/Needs Review |
| Amber/Orange | Warning/Unmatched |
| Red | Urgent/Error |
| Purple | After Hours/Special |
| Gray | Inactive/Voided |

### Getting Help

If you encounter issues:
1. Try refreshing the page
2. Log out and log back in
3. Contact your system administrator

---

*This guide is for the TCDS Insurance Operations Platform. For additional support, contact your manager or system administrator.*

*Last updated: January 13, 2026*
