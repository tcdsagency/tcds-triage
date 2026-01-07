# TCDS-Triage: Field Mappings & Business Logic

**Author**: Manus AI
**Date**: January 6, 2026

This document provides a comprehensive reference for key field mappings, business logic, and data synchronization rules within the TCDS-Triage system. It is intended for developers, system architects, and business analysts.

## 1. HawkSoft Policy Type Codes

This table maps the internal HawkSoft policy type codes to their display names and corresponding emojis used throughout the TCDS-Triage UI.

| Code | Display Name | Emoji |
|---|---|---|
| `AUTOP` | Auto Insurance | 🚗 |
| `HOME` / `HO-3` / `HO-5` | Homeowners Insurance | 🏠 |
| `PUMBR` | Umbrella Insurance | ☂️ |
| `DFIRE` | Dwelling Fire | 🔥 |
| `FLOOD` | Flood Insurance | 🌊 |
| `MHOME` | Mobile Home | 🏠 |
| `CYCLE` | Motorcycle | 🏍️ |
| `BOAT` | Watercraft | ⛵ |
| `RV` | Recreational Vehicle | 🚐 |
| `CGL` | Commercial General Liability | 🏢 |

**Implementation Note**: The system should handle multiple codes for the same policy type (e.g., `HOME`, `HO-3`, `HO-5` all map to "Homeowners Insurance"). A case-insensitive lookup is recommended.

## 2. Coverage Code Mappings

This table maps common insurance coverage codes to their full descriptions. This is used to provide more readable coverage details in the policy view.

| Code | Description |
|---|---|
| `BI` | Bodily Injury Liability |
| `PD` | Property Damage Liability |
| `COMP` | Comprehensive |
| `COLL` | Collision |
| `UMPD` | Uninsured Motorist Property Damage |
| `UMBI` | Uninsured Motorist Bodily Injury |
| `MED` | Medical Payments |
| `TELEM` | Telematics Discount |
| `VIOFR` | Violation Free Discount |
| `PL` | Personal Liability |
| `PP` | Personal Property |
| `LOU` | Loss of Use |
| `OS` | Other Structures |

**Implementation Note**: These codes are often carrier-specific. This list represents common codes, but the system should be designed to accommodate new or different codes from various carriers.

## 3. Policy Status Calculation

The `status` of a policy is a calculated field based on its dates and current system date. This logic determines whether a policy is considered "Active", "Pending", "Cancelled", or "Expired".

| Status | Date Field | Date vs. Today | Active? | Notes |
|---|---|---|---|---|
| **New** | `inceptionDate` | Future | ❌ | Policy has not started yet. |
| **Active** | `effectiveDate` | Past | ✅ | Policy is currently in force. |
| **Pending Renewal** | `effectiveDate` | Future | ❌ | Renewal has been processed but not yet active. |
| **Cancelled** | `statusDate` | Past | ✅ | Policy was active but is now cancelled. |
| **Expired** | `expirationDate` | Past | ❌ | Policy term has ended without renewal. |

### Business Logic for Status Calculation:

```typescript
function calculatePolicyStatus(policy: Policy, today: Date = new Date()): string {
  const effectiveDate = new Date(policy.effectiveDate);
  const expirationDate = new Date(policy.expirationDate);
  const inceptionDate = new Date(policy.inceptionDate);
  const statusDate = policy.statusDate ? new Date(policy.statusDate) : null;

  // Handle cancelled policies first
  if (policy.status === "Cancelled" && statusDate && statusDate <= today) {
    return "Cancelled";
  }

  // Handle expired policies
  if (expirationDate < today) {
    return "Expired";
  }

  // Handle active policies
  if (effectiveDate <= today && expirationDate >= today) {
    return "Active";
  }

  // Handle pending new business
  if (inceptionDate > today) {
    return "Pending (New)";
  }

  // Handle pending renewals
  if (effectiveDate > today) {
    return "Pending (Renewal)";
  }

  return "Unknown";
}
```

## 4. Database Sync Verification

This section outlines the SQL queries used to verify the status and integrity of the data synchronization process between TCDS-Triage and external systems like HawkSoft.

### 4.1. Check Sync Metadata

This query retrieves the metadata for the last successful sync, which is crucial for monitoring and debugging.

```sql
-- Check the status of the last synchronization run
SELECT 
  id,
  last_sync_start_time,
  last_sync_end_time,
  last_sync_status,         -- e.g., 'Completed', 'Failed', 'In Progress'
  records_processed,
  records_added,
  records_updated,
  error_message
FROM 
  hawksoft_sync_metadata
WHERE 
  id = 1; -- Assuming a single metadata record
```

### 4.2. Count Cached Records

This query provides a quick count of the total number of client records currently stored in the local cache. This number should align with the `records_processed` in the metadata.

```sql
-- Count the total number of cached client records
SELECT COUNT(*) AS total_cached_clients
FROM hawksoft_client_cache;
```

### 4.3. Trigger Manual Sync

A manual sync can be triggered via an API endpoint. This is useful for forcing an update or for testing purposes.

**Endpoint**: `POST /api/hawksoft/sync`

**Body**: (optional)
```json
{
  "force_full_sync": true
}
```

**Success Response**:
```json
{
  "status": "Sync process started",
  "jobId": "sync-job-12345"
}
```

## 5. Data Ownership & Flow

- **HawkSoft**: Read-only source of truth for policies and client data.
- **AgencyZoom**: Read-write system for leads, notes, and sales pipeline.
- **TCDS-Triage**: Aggregates data from both, adds its own data (call logs, AI insights, service requests), and writes back to AgencyZoom.

```mermaid
graph TD
    subgraph HawkSoft (Read-Only)
        A[Policies]
        B[Clients]
    end

    subgraph AgencyZoom (Read-Write)
        C[Leads]
        D[Notes]
        E[Pipeline]
    end

    subgraph TCDS-Triage
        F[Unified Customer View]
        G[Call Logs]
        H[AI Insights]
        I[Service Requests]
    end

    A --> F
    B --> F
    C --> F
    D --> F
    F --> G
    F --> H
    F --> I
    I --> D
```

This architecture ensures that the core policy data from HawkSoft remains pristine while allowing for a flexible and interactive sales and service process managed through AgencyZoom and TCDS-Triage.
