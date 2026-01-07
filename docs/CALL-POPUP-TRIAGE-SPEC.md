# Call Popup & Triage Queue - TCDS v21 Unified Spec

## Architecture Principle

Everything flows through **MergedProfile**. The Call Popup uses the exact same data pipeline as the Customer Profile page. No separate data fetching, no parallel systems. One source of truth.

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNIFIED DATA FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Phone Number ──► /api/calls/popup ──► Get hsId + azId        │
│                           │                                     │
│                           ▼                                     │
│              /api/customers/{id}/merged-profile                 │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  MergedProfile  │◄─── Same data as          │
│                  │                 │     Customer Profile       │
│                  │  • policies     │     Page uses              │
│                  │  • household    │                            │
│                  │  • notes        │                            │
│                  │  • clientLevel  │                            │
│                  │  • totalPremium │                            │
│                  └────────┬────────┘                           │
│                           │                                     │
│                           ▼                                     │
│              /api/ai/customer-overview                          │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   AI Overview   │◄─── Same AI as            │
│                  │                 │     Customer Profile       │
│                  │  • summary      │     Page uses              │
│                  │  • coverageGaps │                            │
│                  │  • crossSell    │                            │
│                  │  • riskFlags    │                            │
│                  │  • agentTips    │                            │
│                  └─────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Call Popup

### What Already Exists

**File:** `src/components/features/CallPopup.tsx`
**API:** `GET /api/calls/popup?phone={phone}`

Current implementation fetches basic customer data and policies from local DB. We enhance it to use MergedProfile.

### Enhanced Call Popup Flow

```typescript
// 1. Phone comes in
const phone = "2055551234";

// 2. Lookup returns customer IDs
const lookup = await fetch(`/api/calls/popup?phone=${phone}`);
// Returns: { hawksoftId: "140", agencyzoomId: "16925133", customerId: "uuid" }

// 3. Load full MergedProfile (same endpoint as customer profile page)
const profile = await fetch(
  `/api/customers/${customerId}/merged-profile?hsId=${hawksoftId}&azId=${agencyzoomId}`
);

// 4. Load AI overview (same endpoint as customer profile page)
const aiOverview = await fetch(`/api/ai/customer-overview`, {
  method: "POST",
  body: JSON.stringify({ profile: profile.data })
});

// Now we have EVERYTHING the customer profile page has
```

### Call Popup Data Shape

The popup receives the full `MergedProfile` type (already defined in `types/customer-profile.ts`):

```typescript
interface MergedProfile {
  // Identity
  id: string;
  name: string;
  preferredName?: string;           // "Goes by"
  clientLevel: "A" | "AA" | "AAA";  // ⭐ 🏆 👑
  isOG: boolean;                    // 🌟 OG badge
  customerSince?: string;
  
  // Contact
  contact: { phone, email, mobile };
  
  // Financials
  totalPremium: number;
  activePolicyCount: number;
  activePolicyTypes: Array<{
    type: PolicyType;
    emoji: string;  // 🚗 🏠 ☂️
    count: number;
  }>;
  
  // Full data
  policies: Policy[];
  household: HouseholdMember[];
  notes: Note[];
  
  // Source IDs (for logging back)
  hawksoftId?: number;
  agencyzoomId?: string;
  
  // Agent assignment
  producer?: { id, name };
  csr?: { id, name };
}
```

### AI Overview Shape

Same `AIOverview` already generated by `/api/ai/customer-overview`:

```typescript
interface AIOverview {
  summary: string;              // "Brenda is a AAA customer since 2019..."
  keyFacts: string[];           // Quick bullet points
  
  coverageGaps: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
    suggestedAction: string;
  }>;
  
  crossSellOpportunities: Array<{
    product: string;
    reason: string;
    priority: "high" | "medium" | "low";
    talkingPoints: string[];
  }>;
  
  riskFlags: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
    action?: string;
  }>;
  
  agentTips: string[];          // Contextual suggestions
}
```

### Call Popup UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  📞 INBOUND CALL                              00:45  ─ □ X  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  👑 AAA - Premier    🌟 OG    Customer since 2019   │   │
│  │                                                     │   │
│  │  BRENDA SIMS                                        │   │
│  │  (205) 901-9665 • simsb9665@gmail.com              │   │
│  │                                                     │   │
│  │  🚗 Auto  🏠 Home  🏠 Home  ☂️ Umbrella             │   │
│  │  $5,449/yr total premium                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ AI INSIGHTS ───────────────────────────────────────┐   │
│  │                                                     │   │
│  │  Likely calling about: Auto policy renewal          │   │
│  │  (expires in 12 days)                               │   │
│  │                                                     │   │
│  │  💡 Tips:                                           │   │
│  │  • Review umbrella limits - currently $1M          │   │
│  │  • Verify 2016 4Runner still has comp/coll         │   │
│  │                                                     │   │
│  │  ⚠️ Coverage Gaps:                                  │   │
│  │  • No flood insurance (check flood zone)           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ QUICK ACTIONS ─────────────────────────────────────┐   │
│  │  [📝 Add Note]  [📋 Create Task]  [👤 Open Profile] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ NOTES ─────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ Type notes during call...                   │   │   │
│  │  │                                             │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Note Posting

When agent saves notes, post to both systems:

```typescript
// POST /api/calls/{callId}/complete

interface CallCompleteRequest {
  callId: string;
  customerId: string;
  hawksoftId?: number;
  agencyzoomId?: string;
  
  // Note content
  agentNotes: string;
  
  // Where to post
  postToHawksoft: boolean;
  postToAgencyZoom: boolean;
  
  // Optional follow-up
  createTask?: {
    title: string;
    description: string;
    dueDate?: string;
    priority: "low" | "medium" | "high";
    assignTo?: string;  // User ID
  };
}
```

**HawkSoft Note Posting** (existing endpoint):
```typescript
// POST /api/hawksoft/clients/note
{
  clientId: 140,
  note: "Called about renewal, reviewed coverage options",
  channel: "phone_from_insured"  // or "phone_to_insured"
}
```

**AgencyZoom Note Posting** (existing endpoint):
```typescript
// POST /api/agencyzoom/contacts/{id}/notes
{
  content: "Called about renewal, reviewed coverage options",
  type: "Note"
}
```

---

## Part 2: Triage Queue

### Philosophy

The triage queue shows items needing attention, AI-prioritized. Uses the existing `triageItems` table (already in schema).

### Item Types

```typescript
type TriageType = 
  | "missed_call"      // Call ended without notes
  | "callback"         // Customer requested callback
  | "task"             // General follow-up task
  | "renewal"          // Renewal coming due
  | "endorsement"      // Policy change request
  | "claim"            // Claim-related follow-up
  | "escalation";      // Escalated to producer
```

### AI Priority Scoring

Score 0-100, based on customer value + urgency signals:

```typescript
function calculatePriority(item: TriageItem, profile?: MergedProfile): number {
  let score = 30;  // Base
  
  // Customer value (from MergedProfile)
  if (profile) {
    if (profile.clientLevel === "AAA") score += 25;
    else if (profile.clientLevel === "AA") score += 15;
    else if (profile.clientLevel === "A") score += 5;
    
    if (profile.isOG) score += 10;
    if (profile.totalPremium > 10000) score += 10;
    else if (profile.totalPremium > 5000) score += 5;
  }
  
  // Urgency signals
  if (item.type === "missed_call") score += 15;
  if (item.type === "claim") score += 20;
  if (item.isRepeatCaller) score += 10;
  
  // Time decay (older = higher priority)
  const ageHours = (Date.now() - item.createdAt.getTime()) / 3600000;
  score += Math.min(ageHours * 2, 20);  // +2 per hour, max +20
  
  return Math.min(score, 100);
}

function getPriorityLabel(score: number) {
  if (score >= 80) return { label: "URGENT", color: "red", emoji: "🔴" };
  if (score >= 60) return { label: "HIGH", color: "orange", emoji: "🟠" };
  if (score >= 40) return { label: "MEDIUM", color: "yellow", emoji: "🟡" };
  return { label: "LOW", color: "gray", emoji: "⚪" };
}
```

### Triage API

**Get Queue:**
```typescript
// GET /api/triage?status=pending&page=1&limit=25

interface TriageResponse {
  success: boolean;
  items: TriageItem[];
  stats: {
    pending: number;
    inProgress: number;
    completedToday: number;
    urgent: number;
  };
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
}
```

**Claim Item:**
```typescript
// POST /api/triage/{id}/claim
// Assigns to current user
```

**Complete Item:**
```typescript
// POST /api/triage/{id}/complete
{
  resolution: "Spoke with customer, added driver to policy",
  outcome: "resolved"
}
```

**Escalate:**
```typescript
// POST /api/triage/{id}/escalate
{
  escalateToId: "producer-uuid",
  reason: "Customer requesting policy cancellation"
}
```

### Triage UI

```
┌─────────────────────────────────────────────────────────────────┐
│  TRIAGE QUEUE                                                   │
├─────────────────────────────────────────────────────────────────┤
│  [All] [Pending (12)] [In Progress (3)] [Completed]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 URGENT (87)                                     2 min ago  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Missed Call - Brenda Sims                               │   │
│  │  👑 AAA • (205) 901-9665 • $5,449/yr                     │   │
│  │  Short call (0:23) - possible disconnect                 │   │
│  │                                                          │   │
│  │  [Claim] [View Profile]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🟠 HIGH (72)                                       15 min ago │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Callback Request - Cameron Green                        │   │
│  │  👑 AAA • (205) 555-1234 • $8,200/yr                     │   │
│  │  "Question about adding teenage driver"                  │   │
│  │  Assigned to: Jane D.                                    │   │
│  │                                                          │   │
│  │  [In Progress] [View Profile]                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🟡 MEDIUM (45)                                     1 hr ago   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Renewal Follow-up - Donald Altman                       │   │
│  │  🏆 AA • (205) 555-5678 • $3,100/yr                      │   │
│  │  Auto renewal in 14 days, no response to email           │   │
│  │                                                          │   │
│  │  [Claim] [View Profile]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Auto-Triage Rules

When a call ends, automatically create triage item if needed:

```typescript
async function handleCallEnded(call: Call) {
  const shouldTriage = 
    !call.agentNotes ||                    // No notes taken
    call.durationSeconds < 30 ||           // Very short call
    call.aiExtraction?.needsFollowUp ||    // AI detected follow-up needed
    call.status === "missed";              // Missed/abandoned
  
  if (shouldTriage) {
    await createTriageItem({
      type: call.status === "missed" ? "missed_call" : "callback",
      callId: call.id,
      customerId: call.customerId,
      customerName: call.customerName,
      customerPhone: call.fromNumber,
      title: `${call.status === "missed" ? "Missed" : "Incomplete"} call - ${call.customerName}`,
      description: call.aiExtraction?.summary || "Call ended without notes",
      aiPriorityScore: calculatePriority({ ... }),
    });
  }
}
```

---

## Implementation Checklist

### Phase 1: Call Popup Enhancement
- [ ] Update `/api/calls/popup` to return `hawksoftId` and `agencyzoomId`
- [ ] Load MergedProfile in CallPopup component
- [ ] Load AI Overview in CallPopup component
- [ ] Display customer header with badges (AAA, OG, policy emojis)
- [ ] Display AI insights panel
- [ ] Add note textarea with save functionality

### Phase 2: Note Posting
- [ ] POST to HawkSoft via existing `/api/hawksoft/clients/note`
- [ ] POST to AgencyZoom via existing notes endpoint
- [ ] Combine agent notes with AI summary
- [ ] Track post success/failure

### Phase 3: Triage Queue
- [ ] Create `/api/triage` GET endpoint
- [ ] Create `/api/triage/{id}/claim` endpoint
- [ ] Create `/api/triage/{id}/complete` endpoint
- [ ] Create `/api/triage/{id}/escalate` endpoint
- [ ] Build Triage Queue page UI
- [ ] AI priority scoring

### Phase 4: Auto-Triage
- [ ] Hook into call end events
- [ ] Create triage items for incomplete calls
- [ ] Link to MergedProfile for customer context

---

## Config

| Setting | Value |
|---------|-------|
| Call poll interval | 3 seconds |
| Triage refresh | 15 seconds |
| SLA default | 4 hours |
| SLA urgent | 1 hour |
| Priority recalc | 5 minutes |
