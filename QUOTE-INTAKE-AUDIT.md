# Quote Intake & Policy Service Logic Audit Report

**Generated:** 2026-01-07
**Auditor:** Claude AI System

---

## Executive Summary

| Quote Type | Status | Coverage |
|------------|--------|----------|
| Personal Auto | IMPLEMENTED | 100% |
| Homeowners | IMPLEMENTED | 100% |
| Renters | IMPLEMENTED | 100% |
| Umbrella | IMPLEMENTED | 100% |
| Recreational | IMPLEMENTED | 100% |
| BOP (Commercial) | IMPLEMENTED | 90% |
| General Liability | IMPLEMENTED | 90% |
| Workers Comp | IMPLEMENTED | 90% |
| **Mobile Home** | **NOT IMPLEMENTED** | 0% |
| **Flood** | **NOT IMPLEMENTED** | 0% |
| **Auto+Home Bundle** | **NOT IMPLEMENTED** | 0% |
| **Policy Change Requests** | **NOT IMPLEMENTED** | 0% |

---

## 1. Standard Quote Intake (Auto + Home)

### 1.1 Personal Auto Quote

**Status:** FULLY IMPLEMENTED

**Schema Location:** `src/lib/quote-schemas/personal-auto.ts` (850 lines)
**Form Location:** `src/app/(dashboard)/quote/new/page.tsx`

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Customer Info | First/Last Name, DOB, Phone, Email | Implemented |
| Address | Street, City, State, ZIP | Implemented |
| Marital Status | Single/Married/Divorced/Widowed + Spouse info | Implemented |
| Vehicles | VIN, Year/Make/Model, Ownership, Usage, Mileage | Implemented |
| Drivers | Name, DOB, License, Relationship, Excluded option | Implemented |
| Coverage | BI, PD, UM/UIM, Med Pay, Comp, Collision | Implemented |
| Current Insurance | Carrier, Premium, Reason for shopping | Implemented |
| Discounts | Homeowner, Multi-policy, Good driver, Paperless, Autopay | Implemented |
| Agent Notes | Effective date, Notes | Implemented |

#### Gatekeepers (Decline Triggers):
| Trigger | Action | Status |
|---------|--------|--------|
| Rideshare driver | Warn - needs rideshare endorsement | Implemented |
| DUI/DWI in past 5 years | Escalate for review | Implemented |
| SR-22 required | Document and note | Implemented |

#### VIN Decode Integration:
- Uses NHTSA API: `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/`
- Auto-populates Year, Make, Model

### 1.2 Homeowners Quote

**Status:** FULLY IMPLEMENTED

**Schema Location:** `src/lib/quote-schemas/homeowners.ts` (818 lines)
**Form Location:** `src/app/(dashboard)/quote/new/page.tsx`

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Primary Insured | Name, DOB, Phone, Email, Marital Status | Implemented |
| Co-Insured | Name, DOB (conditional on hasCoInsured) | Implemented |
| Property | Address, Type, Occupancy, Recent Purchase | Implemented |
| Property Details | Year Built, Sq Ft, Stories, Construction, Foundation, Garage | Implemented |
| Roof | Material, Age, Replacement Year | Implemented |
| Systems | Heating, Electrical, Plumbing, Water Heater updates | Implemented |
| Safety | Security system, Fire alarm, Sprinklers, Deadbolts, Distance to fire station | Implemented |
| Liability | Pool, Trampoline, Dog (breed + bite history), Home business | Implemented |
| Mortgage | Lienholder info, Loan number | Implemented |
| Coverage | Dwelling (A), Other Structures (B), Personal Property (C), Liability, Med Pay, Deductibles | Implemented |
| Prior Insurance | Current carrier, Years, Premium, Claims | Implemented |
| Discounts | Bundle, Claims-free, New purchase, Autopay, Paperless | Implemented |

#### Gatekeepers (Decline Triggers):
| Trigger | Action | Status |
|---------|--------|--------|
| Vacant property | Redirect to commercial/vacant home policy | Implemented |
| Mobile home property type | Redirect to mobile home quote | Implemented |
| Roof age > 25 years | Warn - may need inspection | Implemented |

---

## 2. Recreational Quote Intake

**Status:** FULLY IMPLEMENTED

**Schema Location:** `src/lib/quote-schemas/recreational.ts` (1543 lines)
**Form Location:** `src/app/(dashboard)/quote/new/page.tsx`

#### Item Types Supported:
- Boat (Bass, Pontoon, Deck, Bowrider, Center Console, Cabin Cruiser, Ski/Wakeboard, Fishing, Sailboat, Jon Boat)
- Personal Watercraft (PWC/Jet Ski)
- Travel Trailer (Travel, Fifth Wheel, Toy Hauler, Pop-Up, Teardrop)
- UTV/Side-by-Side
- Golf Cart
- Motorhome/RV (Class A, B, C, Super C)
- Tractor

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Customer | Ownership type (Individual/Joint/LLC/Corp), Name, DOB, Contact, Address | Implemented |
| Co-Owner | Name, DOB (conditional) | Implemented |
| Item Details | Year, Make, Model, VIN/HIN, Length, Value | Implemented |
| Boat-Specific | Hull material, Engine type, Horsepower, Fuel, Max speed, Trailer | Implemented |
| PWC-Specific | Engine CC, Seating capacity | Implemented |
| Trailer-Specific | Type, Slide-outs, GVWR, Full-time residence | Implemented |
| UTV-Specific | Street legal, Roll cage | Implemented |
| Golf Cart-Specific | Serial number, Power type, LSV, Customizations | Implemented |
| Motorhome-Specific | Class, Chassis, Towing, Toad description | Implemented |
| Tractor-Specific | Horsepower, Road use, Attachments, Primary use | Implemented |
| Usage/Storage | Primary use, Storage location, Months in use, Water body, Ocean use | Implemented |
| Coverage | Valuation type, Agreed value, Liability, Deductible, Med pay, Add-ons | Implemented |
| Operators | Name, DOB, Relationship, Experience, Safety course | Implemented |
| Loss History | Prior losses description | Implemented |
| Financing | Lienholder info | Implemented |

#### Gatekeepers (Decline Triggers):
| Trigger | Action | Status |
|---------|--------|--------|
| LLC/Corporation ownership | Decline - commercial risk | Implemented |
| Rental/commercial use | Redirect to commercial marine | Implemented |
| Boat year > 25 years old | Warn - limited market | Implemented |
| Full-time RV residence | Warn - specialty carrier needed | Implemented |

---

## 3. Commercial Quote Intake

**Status:** PARTIALLY IMPLEMENTED (Forms exist, no unified schema)

**Schema Location:** `commercial: null // TODO` in `src/lib/quote-schemas/index.ts`
**Form Location:** `src/app/(dashboard)/quote/new/page.tsx`

### 3.1 Business Owner's Policy (BOP)

**Status:** IMPLEMENTED

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Business Info | Name, DBA, FEIN, Type, Years in business | Implemented |
| Contact | Name, Title, Phone, Email | Implemented |
| Location | Address, Owned/Leased, Sq Ft, Year Built, Construction, Stories | Implemented |
| Protection | Sprinkler system, Burglar alarm | Implemented |
| Operations | Description, NAICS code, Revenue, Employee counts | Implemented |
| Property Coverage | Building, BPP, Deductible | Implemented |
| Liability | GL limit, Products/Completed Ops | Implemented |
| Additional | Data breach, Employee dishonesty, Equipment breakdown | Implemented |
| Prior Insurance | Carrier, Premium, Expiration, Claims | Implemented |

### 3.2 General Liability

**Status:** IMPLEMENTED

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Business Info | Name, DBA, FEIN, Type, Years | Implemented |
| Contact | Name, Title, Phone, Email | Implemented |
| Location | Address, Multiple locations | Implemented |
| Operations | Description, NAICS, Class code, Revenue, Payroll, Employees | Implemented |
| Subcontractors | Uses subs, Cost, COI required | Implemented |
| Coverage Limits | Each occurrence, General aggregate, Products/Ops, Personal/Advertising, Med Pay, Damage to premises | Implemented |
| Additional | Additional insured, Waiver of subrogation | Implemented |

### 3.3 Workers Compensation

**Status:** IMPLEMENTED

#### Fields Mapped:
| Field Group | Fields | Status |
|------------|--------|--------|
| Business Info | Name, DBA, FEIN, Type, Years | Implemented |
| Contact | Name, Title, Phone, Email | Implemented |
| Location | Address, Governing class code | Implemented |
| Employees | Class code, Description, Count, Payroll (array) | Implemented |
| Experience Mod | Has mod, Rate, Effective date | Implemented |
| Ownership | Include owners, Owner payroll, Number of owners | Implemented |
| Subcontractors | Uses subs, Cost, Sub coverage | Implemented |
| Prior Insurance | Carrier, Premium, Expiration, Claims | Implemented |

### 3.4 MISSING: Commercial Auto

**Status:** NOT IMPLEMENTED

Per user documentation, should include:
- Business info (Name, FEIN, DOT/MC number)
- Vehicle schedule (VIN, GVW, Radius, Cost new)
- Driver schedule (CDL, MVR, Experience)
- Coverage (Auto Liability, Physical Damage, Cargo, MCS-90)

---

## 4. Mobile Home Quote Intake

**Status:** NOT IMPLEMENTED

**Schema Location:** `mobile_home: null // TODO` in `src/lib/quote-schemas/index.ts`
**Current Behavior:** Homeowners form redirects mobile_home property type

### Required Implementation (Per User Documentation):

#### Customer Information
- Named insured + Secondary named insured
- Contact info, DOB

#### Property Location
- Park name (if applicable)
- Lot number
- Owned vs rented lot
- Park rules/requirements

#### Home Details
- Year manufactured
- Manufacturer
- Model
- Serial number (HUD label)
- Dimensions (width x length)
- Single/Double/Triple wide
- Tie-downs (type, count)
- Foundation (permanent vs temporary)
- Skirting (type, material)

#### Roof & Structure
- Roof type and age
- Roof material
- Metal vs shingled

#### Systems
- Heating type
- AC type
- Water heater
- Electrical service (amp)

#### Additions
- Porches
- Decks
- Carports
- Sheds
- Values for each

#### Mortgage
- Lienholder info
- Loan number

#### Coverage
- Dwelling coverage
- Personal property
- Liability
- Medical payments
- Deductibles

#### Gatekeepers Needed:
| Trigger | Action |
|---------|--------|
| Home > 20 years old | Warn - limited carriers |
| Home > 30 years old | Decline - specialty market only |
| No tie-downs | Decline - wind coverage unavailable |
| Full-time rental | Redirect to landlord policy |

---

## 5. Policy Change Request

**Status:** NOT IMPLEMENTED (Playbooks exist, no form)

**Playbooks Location:** `src/lib/agent-assist/playbooks.ts`
**Current Coverage:** Live call guidance only (no intake form)

### Required Implementation (Per User Documentation):

#### Change Type 1: Add Vehicle
- VIN, Year/Make/Model
- Ownership status
- Lienholder info
- Coverage selection
- Effective date

#### Change Type 2: Remove Vehicle
- Vehicle to remove
- Date sold/traded
- Reason for removal
- New owner info (optional)

#### Change Type 3: Replace Vehicle
- Old vehicle info
- New vehicle info (VIN required)
- Lienholder transfer
- Coverage adjustments

#### Change Type 4: Add Driver
- Driver name, DOB
- License number/state
- Relationship
- Primary vehicle assignment
- Violations/accidents (last 5 years)

#### Change Type 5: Remove Driver
- Driver to remove
- Reason (moved out, deceased, excluded)
- Signed exclusion form (if applicable)

#### Change Type 6: Address Change
- New address
- Garaging location (if different)
- Move date
- All policies to update

#### Change Type 7: Add/Remove Mortgagee
- Lienholder name
- Address
- Loan number
- Action (add/remove/update)

#### Change Type 8: Increase Coverage
- Policy to modify
- Coverage component
- New limit/value
- Reason for increase

#### Change Type 9: Add Coverage
- Coverage type (umbrella, flood, scheduled item)
- Required underlying limits
- New coverage details

#### Change Type 10: Cancel Policy
- Policy to cancel
- Cancellation date
- Reason for cancellation
- Refund method preference
- Confirmation of new coverage (if applicable)

---

## 6. Flood Insurance Quote

**Status:** NOT IMPLEMENTED

**Current UI:** Shows "Coming Soon" badge

### Required Implementation:
- FEMA flood zone lookup
- Elevation certificate info
- Building details
- Coverage A (Building) and Coverage B (Contents)
- Deductible options
- NFIP vs Private flood carriers

---

## 7. Auto + Home Bundle

**Status:** NOT IMPLEMENTED

**Current UI:** Shows "Coming Soon" badge

### Required Implementation:
- Combined intake for both auto and home
- Bundle discount calculation
- Carrier matching for both lines
- Cross-sell opportunities

---

## Recommendations

### Priority 1: Critical Missing Features
1. **Create Mobile Home Quote Schema** - Many customers need this; currently redirects with no form
2. **Create Policy Change Request Form** - Core servicing function is missing

### Priority 2: Commercial Enhancement
3. **Create Commercial Auto Form** - Mentioned in guidance but no form
4. **Create Unified Commercial Schema** - Consolidate BOP/GL/WC

### Priority 3: Product Expansion
5. **Implement Flood Quote** - Required for coastal customers
6. **Implement Auto+Home Bundle** - Revenue opportunity

### Priority 4: Schema Consistency
7. **Convert existing page.tsx forms to schema-driven** - Personal auto, homeowners, recreational have schemas but the form is still hardcoded in page.tsx
8. **Add missing gatekeepers to commercial forms** - Per documentation

---

## File Structure Summary

```
src/
├── lib/quote-schemas/
│   ├── index.ts           # Schema registry (mobile_home, commercial = null)
│   ├── types.ts           # Core types
│   ├── personal-auto.ts   # 850 lines - COMPLETE
│   ├── homeowners.ts      # 818 lines - COMPLETE
│   └── recreational.ts    # 1543 lines - COMPLETE
│
├── lib/agent-assist/
│   ├── playbooks.ts       # Policy change playbooks (no form)
│   ├── form-guidance.ts   # Section tips for quote forms
│   └── types.ts           # Playbook types
│
└── app/(dashboard)/quote/new/
    └── page.tsx           # 2400+ lines - All quote forms
```

---

## Action Items

- [ ] Implement `mobile_home` schema in `src/lib/quote-schemas/mobile-home.ts`
- [ ] Create Policy Change Request form at `src/app/(dashboard)/policy-change/page.tsx`
- [ ] Add commercial auto form to quote/new/page.tsx
- [ ] Implement flood quote when NFIP/private carrier integration ready
- [ ] Implement auto+home bundle workflow
- [ ] Refactor forms to be truly schema-driven (render from schema, not hardcoded)

---

*End of Audit Report*
