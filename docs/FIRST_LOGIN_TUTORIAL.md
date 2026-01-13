# TCDS Insurance Operations Platform
## First Login Tutorial Guide

Welcome to TCDS! This tutorial will walk you through your first login experience and teach you how to use each feature properly. Follow along step-by-step to become proficient with the system.

---

## Table of Contents

1. [Your First Login](#1-your-first-login)
2. [Understanding Your Workspace](#2-understanding-your-workspace)
3. [Tutorial: Finding Customers](#3-tutorial-finding-customers)
4. [Tutorial: Handling Incoming Calls](#4-tutorial-handling-incoming-calls)
5. [Tutorial: Working the Pending Review Queue](#5-tutorial-working-the-pending-review-queue)
6. [Tutorial: Managing Messages](#6-tutorial-managing-messages)
7. [Tutorial: Working Leads](#7-tutorial-working-leads)
8. [Tutorial: Creating Quotes](#8-tutorial-creating-quotes)
9. [Tutorial: Using Canopy Connect](#9-tutorial-using-canopy-connect)
10. [Tutorial: Property Lookups](#10-tutorial-property-lookups)
11. [Tutorial: Generating ID Cards](#11-tutorial-generating-id-cards)
12. [Tutorial: Processing Policy Changes](#12-tutorial-processing-policy-changes)
13. [Tutorial: Using Risk Monitor](#13-tutorial-using-risk-monitor)
14. [Tutorial: Customer Profiles Deep Dive](#14-tutorial-customer-profiles-deep-dive)
15. [Tutorial: Using AI Features](#15-tutorial-using-ai-features)
16. [Tutorial: Personalizing Your Settings](#16-tutorial-personalizing-your-settings)
17. [Daily Workflow Best Practices](#17-daily-workflow-best-practices)
18. [Troubleshooting Common Issues](#18-troubleshooting-common-issues)

---

## 1. Your First Login

### Step 1: Access the System

1. Open your web browser (Chrome recommended)
2. Navigate to your agency's TCDS URL
3. You'll see the login screen

### Step 2: Enter Your Credentials

1. Enter the **email address** provided by your administrator
2. Enter your **temporary password**
3. Click **Sign In**

### Step 3: Set Up Your Profile (First Time Only)

After your first login, you may be prompted to:

1. **Change your password** - Choose a strong password you'll remember
2. **Set up Two-Factor Authentication** (if required by your agency)
3. **Choose your theme** - Light or Dark mode

### Step 4: Explore the Dashboard

Once logged in, you'll land on your **Dashboard**. Take a moment to look around:

- **Left sidebar** - Navigation menu for all features
- **Top area** - Search bar for finding customers
- **Main area** - Quick actions and shortcuts

**Congratulations!** You've successfully logged in. Now let's learn each feature.

---

## 2. Understanding Your Workspace

### The Sidebar Navigation

The left sidebar is your main navigation tool. It's organized into sections:

```
DASHBOARD
├── Dashboard (your home base)

INTAKE & RECEPTION
├── Pending Review (calls/messages needing action)
├── Leads (new prospect management)
├── Calls (call history & recordings)
├── Supervisor (manager view)
├── Messages (SMS conversations)

CUSTOMERS
├── Customers (customer database)
├── Birthday Cards (send greetings)
├── Policy Notices (incoming notices)
├── Policy Change (service requests)
├── Payment Advance (payment requests)
├── Same-Day Payment (premium payments)
├── ID Cards (generate ID cards)

TOOLS & RESOURCES
├── Quotes (quote management)
├── Quote Extractor (PDF extraction)
├── Canopy Connect (insurance data import)
├── Properties (property lookup)
├── Invoice (DEC extraction)
├── Reviews (Google reviews)
├── Risk Monitor (listing alerts)
├── Mortgagee Payments (compliance)

SETTINGS
├── Agency Settings (admin only)
├── My Settings (your preferences)
```

### Understanding Badges

You'll notice **orange badges** with numbers on some menu items:

- **Pending Review (5)** - 5 items need your attention
- **Leads (3)** - 3 new leads waiting
- **Messages (2)** - 2 unread conversations

**Rule of thumb:** Check items with badges first—they need action!

### The Header Bar

At the top of every page, you'll find:

- **Page title** - Shows where you are
- **Refresh button** - Reload current data
- **Your profile** - Click for settings/logout

---

## 3. Tutorial: Finding Customers

**Goal:** Learn to quickly find any customer in the system.

### Method 1: Dashboard Search (Fastest)

1. Click **Dashboard** in the sidebar (or you're already there)
2. Find the **search bar** at the top
3. Try these searches:

**Search by Name:**
```
Type: John Smith
Result: Shows all customers named John Smith
```

**Search by Phone:**
```
Type: 5125551234
Result: Shows customer with that phone number
```

**Search by Partial Info:**
```
Type: Smith
Result: Shows all customers with "Smith" in their name
```

4. Click on a result to open their **Customer Profile**

### Method 2: Customers Page (Full List)

1. Click **Customers** in the sidebar
2. You'll see a searchable list of all customers
3. Use filters to narrow results:
   - Search box for name/phone/email
   - Policy type filter

### Practice Exercise

Try finding these (use test data in your system):
1. [ ] Search for a customer by first name only
2. [ ] Search for a customer by phone number
3. [ ] Search for a customer by email address

**Tip:** Phone searches work with or without dashes. "512-555-1234" and "5125551234" both work!

---

## 4. Tutorial: Handling Incoming Calls

**Goal:** Learn what happens when a call comes in and how to handle it.

### When a Call Arrives

When your phone rings and it's routed through the system:

1. **Screen Pop** - Customer info automatically displays
2. **AI Summary** - Quick overview of why they might be calling
3. **Recent Activity** - Their last interactions with the agency

### During the Call

While on the call, you can:

1. **View Policies** - Click the Policies tab to see coverage details
2. **Check Notes** - See previous call notes and interactions
3. **Chat with AI** - Ask the AI assistant questions about the customer

### After the Call Ends

When you hang up:

1. A **Wrap-Up Form** appears automatically
2. The AI generates a **call summary** for you
3. You can edit the summary if needed
4. Choose an action:
   - **Post Note** - Add to customer's AgencyZoom record
   - **Create Service Request** - Open a ticket for follow-up
   - **Skip** - Don't save (for wrong numbers, etc.)

### Practice Exercise

1. [ ] Have a colleague call you (or use a test call)
2. [ ] Note where customer info appears
3. [ ] Practice navigating tabs during the call
4. [ ] Complete the wrap-up process

---

## 5. Tutorial: Working the Pending Review Queue

**Goal:** Master the most important daily task—reviewing and processing interactions.

### Accessing Pending Review

1. Click **Pending Review** in the sidebar
2. You'll see items in a card layout

### Understanding the Two Tabs

**Pending Tab (Default):**
- Items waiting for your action
- Calls that need notes posted
- Messages that need acknowledgment

**Reviewed Tab:**
- Completed items (notes posted, voided, etc.)
- Auto-voided items (hangups, voicemails)
- Items you can re-submit if needed

### Reading a Pending Item Card

Each card shows:

```
┌─────────────────────────────────────────────┐
│ ✓ MATCHED                           2m ago  │  ← Status & Age
├─────────────────────────────────────────────┤
│ John Smith                                  │  ← Customer Name
│ 📞 (512) 555-1234  📞 Call (↓ in)          │  ← Phone & Direction
│ ID: b590bf12...                            │  ← Call ID (click to copy)
├─────────────────────────────────────────────┤
│ AI SUMMARY                                  │
│ Customer called to inquire about adding    │  ← What the call was about
│ a new vehicle to their auto policy...      │
├─────────────────────────────────────────────┤
│ [Review & Post] [Post Note] [Create SR]    │  ← Action Buttons
│ [Void] [Open in AgencyZoom] [Skip]         │
└─────────────────────────────────────────────┘
```

### Understanding Status Colors

| Status | Color | What It Means | What To Do |
|--------|-------|---------------|------------|
| Matched | Green | Customer identified | Review & Post |
| Needs Review | Blue | Multiple matches found | Select correct customer |
| Unmatched | Amber | No customer found | Find Match or NCM Queue |
| After Hours | Purple | Outside business hours | Review & assign |

### Step-by-Step: Processing a Matched Item

1. **Read the AI Summary** - Understand what the call was about
2. **Click "Review & Post"** - Opens the review modal
3. **Edit if needed** - Correct any errors in the summary
4. **Select outcome:**
   - **Post Note** - Just add a note to their record
   - **Create SR** - Create a service request ticket
5. **Click Submit** - Done!

### Step-by-Step: Processing an Unmatched Item

1. **Read the summary** - Note any identifying information
2. **Check Trestle hint** - If shown, it suggests who the caller might be
3. **Click "Find Match"** - Opens the customer search modal
4. **Search for the customer:**
   - Try phone number first
   - Then try name
   - Check for alternate spellings
5. **Select the correct match** - Click to link them
6. **If no match exists:** Click "NCM Queue" to post to No Customer Match

### Step-by-Step: Using the Reviewed Tab

1. **Click the "Reviewed" tab** at the top
2. **Filter options:**
   - **All** - Everything completed
   - **Reviewed** - Manually reviewed items
   - **Auto-Voided** - Hangups, voicemails auto-removed
3. **To re-submit an item:**
   - Find the item
   - Click **"Re-submit for Review"**
   - It moves back to Pending

### Practice Exercise

1. [ ] Find an item with "Matched" status and post a note
2. [ ] Find an "Unmatched" item and match it to a customer
3. [ ] Check the "Reviewed" tab and view an auto-voided item
4. [ ] Void an item using the Void button

**Tip:** Process items oldest to newest—check the age in the corner!

---

## 6. Tutorial: Managing Messages

**Goal:** Learn to view and respond to SMS conversations.

### Accessing Messages

1. Click **Messages** in the sidebar
2. You'll see a split view:
   - **Left:** List of conversations
   - **Right:** Selected conversation thread

### Understanding the Conversation List

Each conversation shows:
- **Contact name** (or phone if unknown)
- **Last message preview**
- **Time of last message**
- **Unread indicator** (blue dot)

### Reading a Conversation

Messages are color-coded:
- **Gray bubbles (left)** - Customer messages (inbound)
- **Green bubbles (right)** - Agent messages (outbound)
- **Purple bubbles (right)** - Auto-reply messages (AI-generated)

### Sending a Message

1. Select a conversation from the list
2. Type your message in the text box at the bottom
3. Click **Send** or press **Enter**

### Acknowledging Messages

After handling a message thread:
1. Click the **checkmark icon**
2. This marks messages as acknowledged
3. They'll move out of the unread queue

### Practice Exercise

1. [ ] Find an unread conversation
2. [ ] Read through the message history
3. [ ] Send a test reply (to a test number)
4. [ ] Acknowledge the conversation

---

## 7. Tutorial: Working Leads

**Goal:** Learn to claim and work new leads effectively.

### Accessing Leads

1. Click **Leads** in the sidebar
2. You'll see leads sorted by status

### Understanding Lead Statuses

| Status | Meaning | Your Action |
|--------|---------|-------------|
| Queued | New lead waiting | Claim it! |
| Notified | Agent was notified | Check if you should claim |
| Escalated | Unclaimed too long | Claim immediately |
| Claimed | Being worked | Work it or release |
| Converted | Became customer | Celebrate! |
| Expired | Timed out | Review what happened |

### Step-by-Step: Claiming a Lead

1. **Find a "Queued" lead** in the list
2. **Review the info:**
   - Name and contact details
   - Source (where they came from)
   - Initial inquiry notes
3. **Click "Claim"** - You now own this lead
4. **A timer starts** - Work it before it escalates!

### Step-by-Step: Working a Lead

1. **Contact the lead** - Call or text them
2. **Update the status:**
   - "Contacted" - You reached them
   - "Qualified" - They're a good prospect
   - "Not Interested" - They declined
3. **Add notes** - Document your conversation
4. **Convert or close** - Mark final outcome

### Speed Matters!

**Lead response time statistics:**
- Contacted in **5 minutes**: 21x more likely to convert
- Contacted in **30 minutes**: 100x better than 24 hours
- After **24 hours**: Minimal chance of conversion

### Practice Exercise

1. [ ] View the leads queue
2. [ ] Understand each status type
3. [ ] (If available) Claim a test lead
4. [ ] Update the lead status

---

## 8. Tutorial: Creating Quotes

**Goal:** Learn to create new insurance quotes.

### Starting a New Quote

**Method 1: From Dashboard**
1. Go to **Dashboard**
2. Click one of the quick quote buttons:
   - **Auto** | **Home** | **Bundle** | **Boat/RV** | **Business**

**Method 2: From Quotes Page**
1. Click **Quotes** in sidebar
2. Click **New Quote** button

### The Quote Wizard

The wizard guides you through these steps:

**Step 1: Select Quote Type**
- Choose what coverage they need
- Can select multiple (Auto + Home = Bundle)

**Step 2: Customer Information**
- Enter or search for customer
- Contact details
- Personal information

**Step 3: Coverage Details**
Based on quote type:
- **Auto:** Vehicles, drivers, coverage preferences
- **Home:** Property address, home details, coverage limits
- **Bundle:** Both of the above

**Step 4: Review & Submit**
- Verify all information
- Submit for quoting

### Step-by-Step: Auto Quote

1. Click **Auto** from dashboard
2. Enter customer info:
   - Name, DOB, address
   - Contact information
3. Add vehicles:
   - Year, Make, Model
   - VIN (auto-decodes details)
   - Coverage preferences
4. Add drivers:
   - All household members who drive
   - License information
5. Review and submit

### Step-by-Step: Home Quote

1. Click **Home** from dashboard
2. Enter customer info
3. Enter property address
4. Property auto-populates from data sources
5. Verify/edit:
   - Square footage
   - Year built
   - Roof type and age
   - Construction details
6. Select coverage preferences
7. Review and submit

### Practice Exercise

1. [ ] Start a new auto quote
2. [ ] Enter test customer information
3. [ ] Add a test vehicle using VIN lookup
4. [ ] Complete the quote wizard

---

## 9. Tutorial: Using Canopy Connect

**Goal:** Learn to use Canopy to automatically import customer insurance data.

### What is Canopy Connect?

Canopy sends customers a secure link. When they click it:
1. They log into their current insurance carrier
2. Canopy automatically pulls all their policy data
3. You receive complete insurance history without manual entry

### Sending a Canopy Link

1. Click **Canopy Connect** in sidebar
2. Click **Send New Link**
3. Enter customer's phone number
4. Click **Send**
5. Customer receives SMS with secure link

### When Data Arrives

After the customer completes Canopy:
1. Their data appears in your dashboard
2. Status shows:
   - **Synced** - Matched to customer in system
   - **Needs Review** - Needs manual matching

### Matching Canopy Data

If status is "Needs Review":
1. Click on the item
2. Search for the correct customer
3. Select to link them
4. Data syncs to AgencyZoom

### What You Get from Canopy

- **Declarations pages** - Full policy documents
- **ID cards** - Insurance cards
- **Coverage details** - Limits, deductibles
- **Vehicle/property info** - What's insured
- **Claims history** - Past claims

### Practice Exercise

1. [ ] Access Canopy Connect page
2. [ ] Review the dashboard stats
3. [ ] (If available) View a synced Canopy pull
4. [ ] Understand what data is imported

**Tip:** Send Canopy links during quote calls—saves 10+ minutes of data entry!

---

## 10. Tutorial: Property Lookups

**Goal:** Learn to research properties for home insurance quotes.

### Accessing Property Lookup

1. Click **Properties** in sidebar
2. You'll see the property search interface

### Searching for a Property

1. Start typing an address in the search box
2. Select from the dropdown suggestions
3. Click **Search**

### Understanding the Results

**Nearmap Aerial Imagery:**
- High-resolution aerial photos of the property
- AI detects features automatically:
  - **Roof condition** - Age and type
  - **Pool** - Presence and type
  - **Solar panels** - If installed
  - **Trampolines** - Liability concern
  - **Trees** - Coverage percentage
  - **Outbuildings** - Sheds, detached garages

**Property Details:**
- Bedrooms, bathrooms, square footage
- Year built
- Construction type
- Foundation type

**Hazard Exposure:**
- **Wind risk** - Hurricane/tornado exposure
- **Hail risk** - Hail damage probability
- **Flood zone** - FEMA flood designation
- **Fire risk** - Wildfire exposure
- **Earthquake** - Seismic risk

**AI Analysis:**
The system provides an AI-generated underwriting summary:
- Overall risk assessment
- Key concerns to address
- Coverage recommendations

### Exporting Property Reports

1. Click **Download PDF** - Saves report to your computer
2. Click **Email Report** - Send to underwriter

### Practice Exercise

1. [ ] Search for a property address
2. [ ] Review the aerial imagery
3. [ ] Note the hazard exposure scores
4. [ ] Read the AI analysis

**Tip:** Always check for pools and trampolines—they affect liability coverage!

---

## 11. Tutorial: Generating ID Cards

**Goal:** Learn to create and send insurance ID cards to customers.

### Accessing ID Cards

1. Click **ID Cards** in sidebar
2. You'll see the ID card generator

### Step-by-Step: Generate ID Cards

**Step 1: Find the Customer**
1. Type customer name or phone in search
2. Select from results

**Step 2: Select the Policy**
1. Their auto policies appear
2. Select the policy you need cards for
3. Review vehicle information

**Step 3: Generate**
1. Verify the information is correct
2. Click **Generate ID Cards**
3. PDF is created with cards for all vehicles

**Step 4: Deliver**
Choose how to send:
- **Download** - Save PDF to your computer
- **Email** - Send to customer's email address
- **Text** - Send via SMS

### Checking Previous Cards

Scroll down to see **Recent History** - previously generated cards.

### Practice Exercise

1. [ ] Search for a test customer
2. [ ] Select their auto policy
3. [ ] Generate ID cards
4. [ ] Download the PDF

**Tip:** Always verify effective dates before sending—don't send expired cards!

---

## 12. Tutorial: Processing Policy Changes

**Goal:** Learn to process common policy change requests.

### Accessing Policy Change

1. Click **Policy Change** in sidebar
2. You'll see the policy change wizard

### Supported Change Types

| Change Type | Common Reasons |
|-------------|----------------|
| Add Vehicle | Customer bought new car |
| Remove Vehicle | Customer sold/traded car |
| Replace Vehicle | Swapping one car for another |
| Add Driver | New household member |
| Remove Driver | Driver moved out |
| Change Coverage | Adjust limits/deductibles |
| Update Mortgagee | Refinanced home |
| Update Lienholder | Refinanced auto |
| Change Address | Customer moved |

### Step-by-Step: Add a Vehicle

**Step 1: Find the Policy**
1. Search by customer phone number
2. Select the customer
3. Choose the auto policy

**Step 2: Select Change Type**
1. Check "Add Vehicle"
2. Form adapts to show vehicle fields

**Step 3: Enter Vehicle Details**
1. **Enter VIN** - System auto-decodes:
   - Year, Make, Model, Trim
   - Engine, transmission details
2. **Or enter manually:**
   - Year, Make, Model
3. **Additional info:**
   - Purchase date
   - Current mileage
   - Primary use

**Step 4: Coverage Selection**
- Match existing vehicle coverage, OR
- Customize coverage levels

**Step 5: Lienholder (if financed)**
1. Search the lienholder database
2. Select the correct bank
3. Clause info auto-populates

**Step 6: Review & Submit**
1. Review all entered information
2. Add any special notes
3. Click Submit

### Practice Exercise

1. [ ] Start a new policy change
2. [ ] Search for a test customer
3. [ ] Select "Add Vehicle" change type
4. [ ] Practice VIN lookup
5. [ ] Review the completed form

---

## 13. Tutorial: Using Risk Monitor

**Goal:** Learn to monitor policies and respond to listing alerts.

### What is Risk Monitor?

Risk Monitor watches your home insurance customers' properties. When a property is listed for sale, you get an alert so you can:
- Reach out proactively
- Retain the customer at their new home
- Prevent unexpected cancellations

### Accessing Risk Monitor

1. Click **Risk Monitor** in sidebar
2. You'll see the monitoring dashboard

### Understanding the Dashboard

**Summary Stats:**
- **Total Policies** - Homes being monitored
- **Active Alerts** - Properties with listing activity
- **Properties Listed** - Currently on market
- **Properties Sold** - Recently sold

### Alert Types

| Alert | Color | Urgency | Action |
|-------|-------|---------|--------|
| Listed | Orange | Medium | Contact customer |
| Pending | Yellow | High | Sale in progress |
| Sold | Red | Urgent | Property sold |

### Working an Alert

1. **Click on an alert** to see details:
   - Listing price
   - Days on market
   - Customer contact info
   - Link to listing (if available)

2. **Take action:**
   - **Assign to Me** - Take ownership
   - **Acknowledge** - Mark as seen
   - **Resolve** - Mark as handled

3. **When resolving, select outcome:**
   - Customer staying (false alarm)
   - Customer moving, quoted new address
   - Customer moving, policy cancelled
   - Not our customer's property
   - Other

### Tabs Explained

**Alerts Tab:**
- Active listing alerts needing attention
- Filtered by status

**Policies Tab:**
- All monitored home policies
- Shows last check date
- Search and filter options

**Activity Events Tab:**
- System activity log
- API calls and status changes
- Useful for troubleshooting

### Practice Exercise

1. [ ] Review the Risk Monitor dashboard
2. [ ] Understand each alert type
3. [ ] (If available) Click into an alert
4. [ ] Review the Policies tab

**Tip:** Being proactive shows great service and keeps the business!

---

## 14. Tutorial: Customer Profiles Deep Dive

**Goal:** Master the customer profile page for complete customer context.

### Accessing a Customer Profile

Click any customer name anywhere in the system to open their profile.

### Profile Header

At the top you'll see:
- **Customer name** (and preferred name if set)
- **Contact information** - Phone, email, address
- **Quick actions** - Call, text, email buttons
- **Client level** - Bronze, Silver, Gold, Platinum

### Profile Tabs

**Overview Tab:**
- Policy summary at a glance
- Coverage gaps identified
- Quick stats and key dates

**Policies Tab:**
- All active and inactive policies
- Click to expand and see:
  - Carrier and policy number
  - Effective/expiration dates
  - Premium amount
  - Coverage limits
  - Vehicles (for auto)
  - Property details (for home)

**Vehicles Tab:**
- All vehicles across all policies
- Year, make, model, VIN
- Coverage per vehicle
- Lienholder information

**Drivers Tab:**
- All household drivers
- License numbers and status
- Points and violations
- Excluded drivers flagged

**Properties Tab:**
- All property addresses
- Home details (beds, baths, sq ft)
- Construction information
- Hazard exposure data

**Claims Tab:**
- Complete claims history
- Claim dates and amounts
- Status and descriptions
- Useful for underwriting

**Notes Tab:**
- All AgencyZoom notes
- Call summaries
- Service request history
- Filterable by type

**Deep Think Tab (AI):**
- AI-powered customer insights
- Pattern analysis from past interactions
- Suggested actions and talking points
- Historical context

### Practice Exercise

1. [ ] Open a customer profile
2. [ ] Review each tab
3. [ ] Expand a policy to see details
4. [ ] Check the Notes tab for history
5. [ ] Explore the Deep Think AI insights

---

## 15. Tutorial: Using AI Features

**Goal:** Understand and leverage AI throughout the system.

### AI Throughout TCDS

AI is integrated everywhere:

**Call Handling:**
- Automatic call summaries
- Sentiment analysis (customer mood)
- Suggested responses

**Customer Matching:**
- Intelligent matching suggestions
- Confidence scores
- Trestle identity hints for unknown callers

**Property Analysis:**
- Automatic feature detection from aerial imagery
- Risk assessment summaries
- Underwriting recommendations

**Deep Think (Customer Profiles):**
- Historical pattern analysis
- Predictive insights
- Conversation context

### AI Tasks Page

1. Click **AI Tasks** in sidebar
2. See AI-generated daily tasks:

**Task Types:**
- **Outreach** - Customers to contact
- **Upsell** - Cross-sell opportunities
- **Renewal** - Upcoming renewals
- **Service** - Follow-up needed

**Each Task Includes:**
- Priority level (Urgent/High/Medium/Low)
- Estimated duration
- Expected outcome
- Preparation script
- Customer context

### Using AI Effectively

**Best Practices:**
1. **Trust but verify** - AI is helpful but review its suggestions
2. **Edit summaries** - Correct any AI misunderstandings
3. **Provide feedback** - System learns from your corrections
4. **Use context** - AI works better with more data

### Practice Exercise

1. [ ] Review AI Tasks page
2. [ ] Open a customer profile's Deep Think tab
3. [ ] Notice AI summaries in Pending Review
4. [ ] See AI property analysis in Properties lookup

---

## 16. Tutorial: Personalizing Your Settings

**Goal:** Configure your personal preferences and profile.

### Accessing My Settings

1. Click **My Settings** in sidebar
2. You'll see your profile configuration

### Profile Settings

**Personal Information:**
- Update your name
- Change email address
- Set phone number and extension

**Password:**
- Change your password
- Must meet security requirements

### Preferences

**Theme:**
- **Light Mode** - White background
- **Dark Mode** - Dark background (easier on eyes)

**Notifications:**
- Configure alert preferences
- Email notification settings

### Security

**Two-Factor Authentication:**
- Enable for extra security
- Use authenticator app or SMS

**Sessions:**
- View active sessions
- Sign out other devices

### Practice Exercise

1. [ ] Access My Settings
2. [ ] Try switching between Light and Dark mode
3. [ ] Review your profile information
4. [ ] Check security settings

---

## 17. Daily Workflow Best Practices

### Morning Routine

1. **Log in and check Dashboard**
2. **Review Pending Review queue** - Process oldest items first
3. **Check Leads** - Claim any new leads immediately
4. **Review Messages** - Respond to unread SMS
5. **Check AI Tasks** - See prioritized daily tasks

### Throughout the Day

**When a call comes in:**
1. Review screen pop information
2. Use tabs to find relevant policy info
3. Complete wrap-up immediately after call
4. Post note or create service request

**When processing the queue:**
1. Work items oldest to newest
2. Match unmatched calls promptly
3. Don't let items sit—SLAs matter!

**When creating quotes:**
1. Use Canopy Connect to save data entry time
2. Run Property Lookup for home quotes
3. Complete all fields for faster processing

### End of Day

1. **Clear Pending Review** - Don't leave items overnight
2. **Check Messages** - Acknowledge all conversations
3. **Update Leads** - Note status on all claimed leads
4. **Review tomorrow's tasks** - Plan ahead

### Response Time Goals

| Item Type | Target Time |
|-----------|-------------|
| New leads | < 5 minutes |
| Pending Review items | < 90 seconds |
| Messages | < 15 minutes |
| After-hours items | First thing next morning |

---

## 18. Troubleshooting Common Issues

### "I can't find a customer"

**Try these searches:**
1. Search by phone number (without dashes)
2. Search by last name only
3. Search by email address
4. Check for alternate spellings
5. Try partial name search

### "The call didn't match to a customer"

**Possible reasons:**
- Customer called from unknown number
- Phone number not in their record
- Multiple customers match that number

**Solution:**
1. Go to Pending Review
2. Find the unmatched item
3. Click "Find Match"
4. Search and select correct customer
5. Or click "NCM Queue" if truly unknown

### "I can't see certain features"

**Possible reasons:**
- Feature not enabled for your role
- Missing permission

**Solution:**
- Contact your administrator
- They can adjust your feature permissions

### "The page isn't loading"

**Try these steps:**
1. Click the Refresh button
2. Log out and log back in
3. Clear browser cache
4. Try a different browser

### "I made a mistake on a note"

**For Pending Review items:**
1. Go to the Reviewed tab
2. Find the item
3. Click "Re-submit for Review"
4. Make corrections and re-post

**For already-posted notes:**
- Contact your supervisor
- A correction note may need to be added in AgencyZoom

### "The AI summary is wrong"

**Solution:**
1. Always review AI summaries before posting
2. Edit the text to correct errors
3. Your corrections help improve the AI

### Getting Help

If you're still stuck:
1. **Ask a colleague** - They may have encountered the same issue
2. **Contact your supervisor** - For permissions or workflow questions
3. **Check the User Guide** - Detailed documentation available
4. **Contact IT/Admin** - For technical issues

---

## Quick Reference Checklist

### Daily Tasks
- [ ] Process all Pending Review items
- [ ] Respond to Messages
- [ ] Claim and work new Leads
- [ ] Complete AI Tasks
- [ ] Check Risk Monitor alerts

### Before Going Home
- [ ] Pending Review queue is empty
- [ ] All messages acknowledged
- [ ] Lead statuses updated
- [ ] No items waiting > 90 seconds

### Feature Locations
| Need To... | Go To... |
|------------|----------|
| Find a customer | Dashboard search |
| Review calls | Pending Review |
| Send a text | Messages |
| Claim a lead | Leads |
| Create a quote | Dashboard > New Quote |
| Look up property | Properties |
| Generate ID card | ID Cards |
| Process change | Policy Change |
| Check listings | Risk Monitor |
| View reports | Reports |

---

**Congratulations!** You've completed the First Login Tutorial. You now have the knowledge to use TCDS effectively. Remember:

- **Ask questions** - Your team is here to help
- **Practice** - The more you use it, the faster you'll become
- **Provide feedback** - Help us improve the system

Welcome to the team!

---

*TCDS Insurance Operations Platform - First Login Tutorial*
*Last Updated: January 13, 2026*
