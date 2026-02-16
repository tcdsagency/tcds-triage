/**
 * Centralized coverage display name resolver.
 *
 * Merges ACORD-standard codes, carrier-specific overrides (American Strategic,
 * SAFECO, Allstate, Progressive, etc.), and dot-path field resolution into a
 * single shared module consumed by CoverageComparisonTable, DeductiblesSection,
 * and TalkPoints.
 */

// ============================================================================
// Base ACORD / canonical labels
// ============================================================================

export const COVERAGE_DISPLAY_NAMES: Record<string, string> = {
  // --- Home / Property ---
  dwelling: 'Dwelling',
  other_structures: 'Other Structures',
  personal_property: 'Personal Property',
  personal_liability: 'Personal Liability',
  medical_payments_to_others: 'Medical Payments to Others',
  loss_of_use: 'Loss of Use',
  water_damage: 'Water Damage',
  mine_subsidence: 'Mine Subsidence',
  sinkhole: 'Sinkhole',
  hurricane_deductible: 'Hurricane Deductible',
  named_storm_deductible: 'Named Storm',
  cyber_liability: 'Cyber Liability',
  service_line: 'Service Line',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  wind_hail: 'Wind/Hail',
  roof_surfaces: 'Roof Surfaces',
  roof_replacement_cost: 'Roof Replacement Cost',
  extended_dwelling: 'Extended Dwelling',
  personal_property_replacement: 'Personal Property Replacement',
  liability_additional: 'Additional Liability',
  identity_fraud: 'Identity Fraud',
  tropical_cyclone: 'Tropical Cyclone',
  additional_coverage_a: 'Additional Coverage A',
  building_structures_extended: 'Building Structures Extended',
  by_operation_of_law: 'By Operation of Law',
  additional_insured: 'Additional Insured',
  mold: 'Mold',
  ordinance_or_law: 'Ordinance or Law',
  animal_liability: 'Animal Liability',
  screened_enclosure: 'Screened Enclosure',
  personal_injury: 'Personal Injury',
  loss_assessment: 'Loss Assessment',
  building_additions: 'Building Additions',
  special_personal_property: 'Special Personal Property',
  flood: 'Flood',

  // --- Auto ---
  bodily_injury: 'Bodily Injury',
  property_damage: 'Property Damage',
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  uninsured_motorist: 'Uninsured Motorist',
  uninsured_motorist_bi: 'Uninsured Motorist BI',
  uninsured_motorist_pd: 'Uninsured Motorist PD',
  underinsured_motorist: 'Underinsured Motorist',
  medical_payments: 'Medical Payments',
  pip: 'Personal Injury Protection',
  personal_injury_protection: 'Personal Injury Protection',
  tl: 'Towing & Roadside',
  rreim: 'Rental Reimbursement',
  rental_reimbursement: 'Rental Reimbursement',
  towing: 'Towing/Roadside',
  roadside_assistance: 'Roadside Assistance',
  combined_single_limit: 'Combined Single Limit',
  gap_coverage: 'GAP Coverage',
  loan_lease_payoff: 'Loan/Lease Payoff',

  // --- Orion180 / generic home ---
  additional_living_expense: 'Additional Living Expense',
  personal_computer: 'Personal Computer',
  unscheduled_jewelry: 'Unscheduled Jewelry',
  credit_card_securities: 'Credit Card / Securities',
  roof_covering_damage: 'Roof Covering Damage',
  replacement_value_personal_property: 'Replacement Value — Personal Property',
  fortified_roof_upgrade: 'Fortified Roof Upgrade',
  total_insured_value: 'Total Insured Value',

  // --- Cross-carrier common ---
  mexico_coverage: 'Mexico Coverage',
  customized_equipment: 'Customized Equipment',
  freezing_damage: 'Freezing Damage',
  limited_theft: 'Limited Theft',
  functional_replacement_value: 'Functional Replacement Value',
  bodily_injury_punitive: 'Bodily Injury (Punitive)',
  general_personal_liability: 'General Personal Liability',
  extended_away_from_premises: 'Extended Away From Premises',
  original_equipment_manufacturer: 'OEM Parts Coverage',
  inflation_guard: 'Inflation Guard',
  landlord_furnishings: 'Landlord Furnishings',
  long_term_vacancy: 'Long-Term Vacancy',
  matching_undamaged_siding: 'Matching Undamaged Siding',
  mature_driver_discount: 'Mature Driver Discount',
  debris_removal: 'Debris Removal',
  fire_department_charge: 'Fire Department Service Charge',
  base_premium: 'Base Premium',
  anti_theft: 'Anti-Theft Device',
  bed_bug_coverage: 'Bed Bug Coverage',
  enhanced_coverage_deductible: 'Enhanced Coverage Deductible',
  enhanced_coverage_premium: 'Enhanced Coverage Premium',
  group_rating: 'Group Rating',
  boost_coverage: 'Boost Coverage',
  new_vehicle: 'New Vehicle Discount',

  // --- National General / Integon ---
  acquisition_fee: 'Acquisition Fee',
  accidental_death_benefit: 'Accidental Death Benefit',
  multi_policy_discount: 'Multi-Policy Discount',
  multi_car_discount: 'Multi-Car Discount',
  good_driver_discount: 'Good Driver Discount',
  good_student_discount: 'Good Student Discount',
  insurance_agency_discount: 'Insurance Agency Discount',
  multi_car_credit_discount: 'Multi-Car Credit Discount',
  new_business_discount: 'New Business Discount',
  enclosed_garage: 'Enclosed Garage Discount',
  family_discount: 'Family Discount',
  all_vehicle_discount: 'All Vehicle Discount',

  // --- GEICO / watercraft ---
  acquisition_discount: 'Acquisition Discount',
  affiliation_discount: 'Affiliation Discount',
  motor_truck_cargo: 'Motor Truck Cargo',
  non_trucking_liability: 'Non-Trucking Liability',
  filing_fee: 'Filing Fee',
  additional_insured_1: 'Additional Insured #1',
  additional_insured_2: 'Additional Insured #2',
  additional_insured_3: 'Additional Insured #3',

  // --- American Strategic ---
  hurricane_surcharge: 'Hurricane Surcharge',
  extended_roof: 'Extended Roof Coverage',
  hip_roof: 'Hip Roof Discount',
  home_package: 'Home Package',
  home_platinum: 'Home Platinum',
  claims_surcharge: 'Claims Surcharge',
  dwelling_water_damage: 'Dwelling Water Damage',
  limited_water_damage: 'Limited Water Damage',
  actual_cash_value_roof: 'Actual Cash Value — Roof',
  additional_building: 'Additional Building',
  new_home_discount: 'New Home Discount',
  existing_policy_discount: 'Existing Policy Discount',

  // --- CAN Modern ---
  enhanced_coverage: 'Enhanced Coverage',
  burglar_alarm: 'Burglar Alarm Discount',
  comprehensive_personal_liability: 'Comprehensive Personal Liability',
  loss_assessment_protection: 'Loss Assessment Protection',
  landlord_personal_liability: 'Landlord Personal Liability',
  mold_limit: 'Mold Limit',
  mold_premium: 'Mold Premium',

  // --- Progressive ---
  accessories_coverage: 'Accessories Coverage',
  continuous_coverage: 'Continuous Coverage Discount',
  declining_savings_bonus: 'Declining Savings Bonus',
  defensive_driving_discount: 'Defensive Driving Discount',
  distant_student: 'Distant Student Discount',
  emergency_expense: 'Emergency Expense',
  mature_driver: 'Mature Driver',
  multi_car_endorsement: 'Multi-Car Endorsement',
  maximum_collision: 'Maximum Collision',
  maximum_other_than_collision: 'Maximum Other Than Collision',
  non_trucking: 'Non-Trucking',

  // --- Misc ---
  business_pursuits_home: 'Business Pursuits — Home',
  credit_card_monthly: 'Credit Card Monthly',
  credit_card_surcharge: 'Credit Card Surcharge',
  violation_surcharge: 'Violation Surcharge',
  billing_code: 'Billing Code',
  age_dwelling: 'Age of Dwelling Factor',
  agreed_value: 'Agreed Value',
  alarm_1: 'Alarm System — Primary',
  alarm_2: 'Alarm System — Secondary',
  auto_policy: 'Auto Policy',
  basic_risk: 'Basic Risk',
  business_use: 'Business Use',
  driver: 'Driver Rating',
  glass: 'Glass Coverage',
  home_factor: 'Home Factor',
  old_wiring: 'Old Wiring',
  paid: 'Paid-in-Full Discount',
  single_limit: 'Single Limit',
  theft: 'Theft Coverage',
  tort: 'Tort Selection',
  hlfc: 'Home Liability Fire Coverage',
  numst: 'Named Storm Deductible',
  wleak: 'Water Leak',
  wndsd: 'Wind/Hail Deductible',
  pdif: 'Property Damage Increase Factor',
  smoke: 'Smoke Detector Discount',
  smart: 'Smart Home Discount',
  telem: 'Telematics Discount',
  tier: 'Tier Rating',
  terr: 'Territory Rating',
  stock: 'Stock Coverage',
  super: 'Superior Coverage',
  ultra: 'Ultra Coverage',
  pest: 'Pest Coverage',
  trip: 'Trip Coverage',
  brand: 'Brand Factor',
  dimin: 'Diminishing Deductible',
  opteq: 'Optional Equipment',
  origo: 'Origination Fee',
  hsp: 'Homestead Protection',
  ifree: 'Incident-Free Discount',
  ccomp: 'Comprehensive — Commercial',
  moldr: 'Mold Remediation',
  oemcl: 'OEM Collision Coverage',
  oemcp: 'OEM Comprehensive Coverage',
  oemgl: 'OEM Glass Coverage',
  opprf: 'Optional Property Factor',
  othft: 'Other Than Collision — Full',
  llf01: 'Liability Limit Factor',
  elmch: 'Electronics Matching Coverage',
  exnon: 'Excluded Non-Owned',
  papls: 'Personal Auto — Personal Liability',
  passl: 'Passenger Liability',
  cdtcd: 'Collision Deductible Credit',
  sewra: 'Sewer/Water Backup — Rider A',
  serln: 'Service Line Coverage',
  roofp: 'Roof Premium',
  pcl: 'Personal Contents Limit',
  pdmm: 'Property Damage — Minimum',
  pdud: 'Property Damage — Underinsured',
  pem: 'Premium Endorsement Modifier',
  umcsl: 'UM Combined Single Limit',
  umdis: 'UM Discount',
  wde: 'Wind Deductible Enhancement',
  wlb: 'Watercraft Liability',
  woods: 'Wooded Area Surcharge',
  xrcod: 'Extended Replacement Cost — Dwelling',

  // --- Coterie commercial (BOP) ---
  acoff: 'Additional Coverage — Off-Premises',
  acon: 'Additional Coverage — On-Premises',
  bica: 'Business Income — Coverage A',
  bidp: 'Business Income — Daily Payment',
  biepi: 'Business Income — Extended Period',
  biope: 'Business Income — Operating Expenses',
  bldcc: 'Building Coverage C',
  blddc: 'Building Deductible',
  bppof: 'Business Personal Property — Off-Premises',
  brcnt: 'Branch Content',
  bulpm: 'Building Limit Premium',
  busin: 'Business Income',
  busus: 'Business Use Surcharge',
  cctcd: 'Commercial Crime — Theft Coverage',
  cfftf: 'Commercial Fire — Full Coverage',
  cfurs: 'Commercial Furnishings',
  clmex: 'Claims Experience',
  coneq: 'Contractors Equipment',
  cpint: 'Commercial Property Interest',
  ctrft: 'Contractor Factor',
  eaocc: 'Each Occurrence',
  edpbi: 'EDP — Business Income',
  edpeq: 'EDP — Equipment',
  edplc: 'EDP — Lost Coverage',
  ee: 'Employee Expense',
  empdh: 'Employee Dishonesty',
  fddr: 'Fire Department Deductible',
  fiart: 'Fine Arts Coverage',
  firdm: 'Fire Damage',
  forga: 'Forgery Alteration',
  genag: 'General Aggregate',
  glste: 'General Liability — Slip Trip',
  glsti: 'General Liability — Statutory',
  inajs: 'Income Adjustment',
  intsl: 'Inland Transit — Single Limit',
  lbi: 'Liability — Bodily Injury',
  medex: 'Medical Expense',
  nabpp: 'Named Business Personal Property',
  newap: 'New Acquisition — Property',
  oprdc: 'Operations — Products/Completed',
  outpr: 'Outdoor Property',
  outsi: 'Outdoor Signs',
  pairs: 'Pairs & Sets',
  paper: 'Valuable Papers',
  passr: 'Passenger Surcharge',
  perst: 'Personal Stealing',
  petp: 'Pet Coverage — Premium',
  pfree: 'Penalty-Free',
  pfrth: 'Property — Further Coverage',
  piadv: 'PI — Advertising Injury',
  pihom: 'PI — Home Office',
  pintr: 'PI — Internet Liability',
  pjwl: 'Personal Jewelry',
  pless: 'Professional Lessors',
  plprm: 'Personal Liability Premium',
  pmdis: 'Premium Discount',
  pmrpl: 'Premium — Replacement',
  pmsl: 'Premium — Single Limit',
  polfe: 'Policy Fee',
  pop: 'Product/Operations — Premium',
  pplan: 'Payment Plan',
  pplsd: 'Personal Property — Limited',
  ppot: 'Personal Property — Other',
  pprls: 'Personal Property — Release',
  prdco: 'Products/Completed Operations',
  presv: 'Preservation Coverage',
  prlia: 'Professional Liability',
  pst: 'Premium Surcharge — Tax',
  rdecc: 'Replacement Deductible',
  rdis: 'Renewal Discount',
  recld: 'Recovery — Limited',
  res1: 'Reserve Factor 1',
  resid: 'Residential Factor',
  ridap: 'Rider — Additional Property',
  rlsrc: 'Release Surcharge',
  rpded: 'Replacement — Deductible',
  rrgap: 'Rental Reimbursement — GAP',
  rrt: 'Rental Reimbursement — Total',
  rrwdt: 'Rental Reimbursement — Waiver',
  rvdep: 'RV Depreciation',
  rvee: 'RV — Emergency Expense',
  rvtrl: 'RV — Trailer',
  saaca: 'SAFECO — Accident Coverage A',
  sdb: 'Snap Deductible Buyback',
  secco: 'Security Coverage',
  seld: 'Self-Employed Discount',
  slsmp: 'Sales Sample',
  smv: 'Special Multi-Vehicle',
  spls: 'Special Liability — Supplement',
  spltx: 'Split Limit — Tax',
  spp: 'Special Personal Property',
  sppp: 'Special Personal Property Premium',
  ssr: 'State Surcharge',
  std: 'State Tax/Discount',
  sts01: 'State Surcharge 01',
  sts02: 'State Surcharge 02',
  sumpp: 'Summary — Personal Property',
  sv1: 'Service Charge 1',
  svcln: 'Service Line',
  swmpl: 'Swimming Pool Liability',
  tdisc: 'Total Discount',
  tentl: 'Tenant Liability',
  therm: 'Thermostat Discount',
  thfpd: 'Theft — Property Damage',
  tmpst: 'Temporary Structure',
  tmres: 'Temporary Residence',
  tnc: 'Transportation Network Coverage',
  towb: 'Towing — Basic',
  tr1: 'Tier 1',
  tr2: 'Tier 2',
  tr3: 'Tier 3',
  travl: 'Travel Coverage',
  trmpl: 'Trampoline Liability',
  trnsf: 'Transfer Discount',
  tschg: 'Territory Surcharge',
  tsp: 'Territory — Special',
  uanml: 'Unregistered Animal',
  ubd: 'Umbrella — Basic Deductible',
  ubp: 'Umbrella — Basic Premium',
  ubs: 'Umbrella — Basic Surcharge',
  ungun: 'Unregistered Firearm',
  unjwf: 'Unscheduled Jewelry — Full',
  utldd: 'Utility Deductible',
  vacat: 'Vacancy Surcharge',
  vaclb: 'Vacancy — Liability',
  valup: 'Value Update',
  vehuc: 'Vehicle Use Classification',
  vmm: 'Vehicle Mileage Modifier',
  vpaol: 'VP — Auto/Other Liability',
  watrb: 'Water Backup',
  windo: 'Window Coverage',
  wpopl: 'Watercraft Property — Outboard',
  wucsl: 'Watercraft UM — CSL',
  wvsub: 'Waiver — Subrogation',
  ydd: 'Young Driver Discount',
  yddrv: 'Young Driver',

  // --- Accredited Surety / Commercial BOP / Cyber ---
  accts: 'Accounts Receivable',
  addcv: 'Additional Coverage',
  addll: 'Additional Liability Limit',
  apmp: 'Aggregate Products Premium',
  asbbx: 'Assigned Risk — BOP Box',
  autoi: 'Auto Included',
  badcv: 'Building Additional Coverage',
  bbprl: 'BOP — Business Personal Property Limit',
  biedp: 'Business Income — EDP',
  bldg: 'Building Coverage',
  boenh: 'BOP Enhancement',
  busee: 'Business Expense',
  cadcv: 'Contents Additional Coverage',
  cpatk: 'Cyber — Phishing Attack',
  cybst: 'Cyber — Standard',
  cyext: 'Cyber — Extended',
  cylw: 'Cyber — Legal Work',
  cymhc: 'Cyber — Media/Harm Coverage',
  cymuc: 'Cyber — Multi-Use Coverage',
  cypfp: 'Cyber — PCI Fines & Penalties',
  cyrfp: 'Cyber — Ransomware/Fraud Protection',
  cyxcr: 'Cyber — Extended Coverage Rider',
  datac: 'Data Compromise',
  eblia: 'E-Business Liability',
  edlia: 'Employment Discrimination Liability',
  erpl: 'Extended Replacement — Personal Liability',
  exn01: 'Exclusion — Non-Owned Auto',
  fitrv: 'First Party — Travel/Recreation',
  funbv: 'Functional Building Value',
  idrc: 'Identity Recovery Coverage',
  infl: 'Inflation Guard',
  irpm: 'Increased Replacement — Premium',
  ladcv: 'Landlord Additional Coverage',
  lcdpp: 'Loss of Computer Data — Personal Property',
  legrv: 'Legal Review',
  netsp: 'Network Security/Privacy',
  prres: 'PR/Reputation Restoration',
  prsvs: 'Privacy — Supervisory',
  ps01: 'Property Schedule 01',
  ps02: 'Property Schedule 02',
  reste: 'Restoration Expense',
  sfty: 'Safety Credit',
  spc: 'Special Coverage',
  spoil: 'Spoilage',
  techf: 'Technology Fee',
  tria: 'Terrorism Risk Insurance',
  whbil: 'Wholesale Billing',
  whded: 'Wholesale Deductible',
  wndst: 'Wind/Storm Coverage',

  // --- Exclusion endorsements (x-prefixed) ---
  xabum: 'Excl — Abuse/Molestation',
  xawir: 'Excl — Asbestos/Lead/EIFS',
  xawrn: 'Excl — Asbestos Warning',
  xbypd: 'Excl — Bypass Property Damage',
  xcmds: 'Excl — Communicable Disease',
  xcybr: 'Excl — Cyber Breach',
  xdscl: 'Excl — Discrimination',
  xedco: 'Excl — Employee Dishonesty',
  xemp: 'Excl — Employment Practices',
  xfung: 'Excl — Fungus/Mold',
  xlead: 'Excl — Lead Paint',
  xnucl: 'Excl — Nuclear Hazard',
  xnvst: 'Excl — Investment Advisory',
  xpolu: 'Excl — Pollution',
  xprof: 'Excl — Professional Services',
  xslds: 'Excl — Silica/Lead/Dust',
  xtria: 'Excl — Terrorism',
  xumac: 'Excl — Unmanned Aircraft',
  xy2k: 'Excl — Year 2000',

  // --- Short-code fallbacks (old snapshots built before COVERAGE_CODE_MAP) ---
  // American Strategic
  abild: 'Accredited Builder Discount',
  hroof: 'Hip Roof Discount',
  aqdis: 'All Quotes Discount',
  epold: 'Existing Policy Discount',
  lwtdm: 'Limited Water Damage',
  alar1: 'Alarm System — Primary',
  alar2: 'Alarm System — Secondary',
  marst: 'Married Status Discount',
  child: 'Child Discount',
  nhdis: 'New Home Discount',
  dswat: 'Distance to Water',
  hplat: 'Home Platinum',
  hpack: 'Home Package',
  // Integon / National General
  adb: 'Accidental Death Benefit',
  mulp: 'Multi-Policy Discount',
  mcar: 'Multi-Car Discount',
  nbsdc: 'New Business Discount',
  acqis: 'Acquisition Fee',
  accfv: 'Accident Forgiveness',
  aqd: 'Advance Quote Discount',
  gsd: 'Good Student Discount',
  // Allstate
  ghppd: 'Good Hands People Program Discount',
  viol: 'Violation Surcharge',
  // Universal P&C
  hurr: 'Hurricane Deductible',
  // GEICO
  eftd: 'Auto Pay Discount',
  // American Strategic rating components (baseline short codes)
  hofac: 'Home Factor',
  butln: 'Building Outline',
  cfact: 'Construction Factor',
  fbasp: 'Base Premium',
  dwupd: 'Dwelling Update',
  agedw: 'Age of Dwelling Factor',
  // Cross-carrier (from baselines)
  grprt: 'Group Rating',
  mexco: 'Mexico Coverage',
  custe: 'Customized Equipment',
  auext: 'Auto Extension',
  wliab: 'Personal Liability',
  autop: 'Auto Policy',

  // --- Additional carrier-specific ---
  additional_dwelling_fire: 'Additional Dwelling Fire',
  additional_factors: 'Additional Factors',
  additional_specified_personal_liability: 'Additional Specified Personal Liability',
  adult_discount: 'Adult Discount',
  alarm_discount: 'Alarm Discount',
  all_quotes_discount: 'All Quotes Discount',
  accident_personal_effects: 'Accident — Personal Effects',
  auto_discount: 'Auto Discount',
  auto_extension: 'Auto Extension',
  auto_motorcycle: 'Auto/Motorcycle',
  basic_auto_adjustment: 'Basic Auto Adjustment',
  basic_extended_coverage: 'Basic Extended Coverage',
  basic_personal_liability: 'Basic Personal Liability',
  blanket_additional_insured: 'Blanket Additional Insured',
  bodily_injury_underinsured: 'Bodily Injury — Underinsured',
  building_outline: 'Building Outline',
  building_value_maintenance: 'Building Value Maintenance',
  business_auto_home: 'Business Auto/Home Discount',
  child_discount: 'Child Discount',
  commercial_driver_license: 'Commercial Driver License',
  comprehensive_collision: 'Comprehensive/Collision',
  comprehensive_deductible: 'Comprehensive Deductible',
  construction_factor: 'Construction Factor',
  coverage_extension: 'Coverage Extension',
  customer_east: 'Customer — East Region',
  dwelling_update: 'Dwelling Update',
  employee_auto_fleet: 'Employee Auto Fleet',
  equipment_coverage: 'Equipment Coverage',
  extended_perils: 'Extended Perils',
  fan_liability: 'Fan Liability',
  full_coverage: 'Full Coverage',
  full_dwelling_security: 'Full Dwelling Security',
  full_payment_discount: 'Full Payment Discount',
  general_liability: 'General Liability',
  group_home_property_damage: 'Group Home Property Damage',
  illinois_medical_coverage: 'Illinois Medical Coverage',
  inspection_fee: 'Inspection Fee',
  life_discount: 'Life Insurance Discount',
  married_status: 'Married Status Discount',
  medical_expense_personal_liability: 'Medical Expense — Personal Liability',
  merit_discount: 'Merit Discount',
  mold_liability_exclusion: 'Mold Liability Exclusion',
  month_occupied: 'Month Occupied',
  mortgagee_clause: 'Mortgagee Clause',
  mortgagee_fee: 'Mortgagee Fee',
  motor_coverage: 'Motor Coverage',
  motorized_vehicle_1: 'Motorized Vehicle #1',
  multiple_unit: 'Multiple Unit',
  navigation_warranty: 'Navigation Warranty',
  personal_effects: 'Personal Effects',
  pollution_liability: 'Pollution Liability',
  premises_liability: 'Premises Liability',
  replacement_cost_contents: 'Replacement Cost — Contents',
  trailer_coverage: 'Trailer Coverage',
  watercraft_hull: 'Watercraft Hull',
  watercraft_uninsured: 'Watercraft Uninsured Motorist',
  waterski_liability: 'Waterski Liability',
  accident_forgiveness: 'Accident Forgiveness',
  application_fee: 'Application Fee',

  // --- Allstate canonical ---
  DWELL: 'Dwelling',
  ADDLIV: 'Additional Living Expenses',
  OTHSTR: 'Other Structures',
  PERSPR: 'Personal Property',
  FXEXP: 'Fixed Expenses',

  // --- SAFECO canonical ---
  OS: 'Other Structures',
  PP: 'Personal Property',
  LOU: 'Loss of Use',
  PL: 'Personal Liability',
  MEDPM: 'Medical Payments to Others',
  EDC: 'Extended Dwelling Coverage',

  // --- Orion180 raw codes ---
  ALEXP: 'Additional Living Expense',
  alexp: 'Additional Living Expense',
  PC: 'Personal Computer',
  pc: 'Personal Computer',
  UNJEW: 'Unscheduled Jewelry',
  unjew: 'Unscheduled Jewelry',
  CCSV: 'Credit Card / Securities',
  ccsv: 'Credit Card / Securities',
  RCD: 'Roof Covering Damage',
  rcd: 'Roof Covering Damage',
  Rvpp: 'Replacement Value — Personal Property',
  rvpp: 'Replacement Value — Personal Property',
  FortifiedRoofUpgrade: 'Fortified Roof Upgrade',
  frfu: 'Fortified Roof Upgrade',
  TIV: 'Total Insured Value',
  tiv: 'Total Insured Value',
  LAC: 'Additional Liability',
  BOLAW: 'By Operation of Law',
  SEWER: 'Sewer/Water Backup',

  // --- Progressive canonical ---
  BI: 'Bodily Injury',
  PD: 'Property Damage',
  COLL: 'Collision',
  COMP: 'Comprehensive',
  UM: 'Uninsured Motorist',
  UMBI: 'Uninsured Motorist BI',
  UMPD: 'Uninsured Motorist PD',
  UIM: 'Underinsured Motorist',
  MP: 'Medical Payments',
  PIP: 'Personal Injury Protection',
  TL: 'Towing & Roadside',
  RREIM: 'Rental Reimbursement',
  CSL: 'Combined Single Limit',
};

// ============================================================================
// Carrier-specific override maps
// ============================================================================

const CARRIER_OVERRIDES: Record<string, Record<string, string>> = {
  'american strategic': {
    hlfc: 'Home Liability Fire Coverage',
    wndsd: 'Wind/Hail Deductible',
    pdif: 'Property Damage Increase Factor',
    numst: 'Named Storm Deductible',
    wleak: 'Water Leak',
    rcd: 'Roof Covering Damage',
    byol: 'By Operation of Law',
    ircd: 'Increased Replacement Cost — Dwelling',
    clms: 'Claims Surcharge',
    fxbs: 'Fixed Base Premium',
    aodw: 'All Other Dwelling Perils',
    frpr: 'Fire Protection',
    aqds: 'All Quotes Discount',
    hmup: 'Home Update',
    nrnh: 'Non-Renewed/Non-Homestead',
    clmf: 'Claims Free',
    tpds: 'Third Party Designation',
    pifd: 'Paid In Full Discount',
  },
  orion: {
    ALEXP: 'Additional Living Expense',
    PC: 'Personal Computer',
    UNJEW: 'Unscheduled Jewelry',
    CCSV: 'Credit Card / Securities',
    RCD: 'Roof Covering Damage',
    Rvpp: 'Replacement Value — Personal Property',
    FortifiedRoofUpgrade: 'Fortified Roof Upgrade',
    TIV: 'Total Insured Value',
    LAC: 'Additional Liability',
    BOLAW: 'By Operation of Law',
    SEWER: 'Sewer/Water Backup',
    OS: 'Other Structures',
    PP: 'Personal Property',
    PL: 'Personal Liability',
    MEDPM: 'Medical Payments to Others',
    DWELL: 'Dwelling',
  },
  safeco: {
    DWELL: 'Dwelling',
    OS: 'Other Structures',
    PP: 'Personal Property',
    LOU: 'Loss of Use',
    PL: 'Personal Liability',
    MEDPM: 'Medical Payments to Others',
    EDC: 'Extended Dwelling Coverage',
  },
  allstate: {
    DWELL: 'Dwelling',
    ADDLIV: 'Additional Living Expenses',
    OTHSTR: 'Other Structures',
    PERSPR: 'Personal Property',
    FXEXP: 'Fixed Expenses',
  },
};

function normalizeCarrier(carrier: string | undefined): string {
  if (!carrier) return '';
  return carrier.toLowerCase().replace(/insurance|company|group|inc\.?|llc\.?|corp\.?/gi, '').trim();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve a single coverage code to a human-readable name.
 *
 * Checks carrier-specific overrides first, then the base map, then falls back
 * to title-casing the code.
 */
export function resolveCoverageDisplayName(code: string, carrier?: string): string {
  // 1. carrier override
  if (carrier) {
    const key = normalizeCarrier(carrier);
    for (const [prefix, overrides] of Object.entries(CARRIER_OVERRIDES)) {
      if (key.includes(prefix)) {
        const hit = overrides[code] || overrides[code.toLowerCase()] || overrides[code.toUpperCase()];
        if (hit) return hit;
      }
    }
  }

  // 2. base map (exact, then case-insensitive)
  if (COVERAGE_DISPLAY_NAMES[code]) return COVERAGE_DISPLAY_NAMES[code];
  if (COVERAGE_DISPLAY_NAMES[code.toLowerCase()]) return COVERAGE_DISPLAY_NAMES[code.toLowerCase()];
  if (COVERAGE_DISPLAY_NAMES[code.toUpperCase()]) return COVERAGE_DISPLAY_NAMES[code.toUpperCase()];

  // 3. title-case fallback: "wind_hail" → "Wind Hail", "DWELL" → "Dwell"
  return code
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve a dot-path field name (as used in MaterialChange / CheckResult)
 * to a human-readable label.
 *
 * Examples:
 *   "coverage.other_structures.limit"  → "Other Structures"
 *   "deductible.wind_hail"             → "Wind/Hail"
 *   "premium"                          → "Premium"
 *   "vehicle.2024_Toyota_Camry"        → "2024 Toyota Camry"
 */
export function resolveFieldDisplayName(fieldPath: string, carrier?: string): string {
  if (!fieldPath) return fieldPath;

  const parts = fieldPath.split('.');

  // "coverage.<type>.limit" / "coverage.<type>.premium"
  if (parts[0] === 'coverage' && parts.length >= 2) {
    return resolveCoverageDisplayName(parts[1], carrier);
  }

  // "deductible.<type>"
  if (parts[0] === 'deductible' && parts.length >= 2) {
    return resolveCoverageDisplayName(parts[1], carrier);
  }

  // "premium" standalone
  if (parts[0] === 'premium') return 'Premium';

  // "vehicle.<desc>" / "driver.<desc>"
  if ((parts[0] === 'vehicle' || parts[0] === 'driver') && parts.length >= 2) {
    return parts.slice(1).join(' ').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Fallback: try resolving the whole thing as a coverage code
  const resolved = resolveCoverageDisplayName(fieldPath, carrier);
  if (resolved !== fieldPath) return resolved;

  // Last resort: title-case the entire path
  return fieldPath
    .replace(/\./g, ' ')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
