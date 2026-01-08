/**
 * Centralized Access Control Configuration
 * =========================================
 * All role-based access control emails are defined here.
 * Update this file to modify who has access to restricted features.
 *
 * TODO: Consider moving to database for dynamic management.
 */

// Intake team - can access /triage, /leads, /supervisor
export const INTAKE_TEAM_EMAILS = [
  'todd.conn@tcdsagency.com',
  'lee.tidwell@tcdsagency.com',
  'stephanie.goodman@tcdsagency.com',
  'paulo.gacula@tcdsagency.com',
] as const;

// Supervisor access - can view supervisor dashboard
export const SUPERVISOR_ACCESS_EMAILS = [
  'todd.conn@tcdsagency.com',
  'lee.young@tcdsagency.com',
] as const;

// Agency settings access - can modify agency configuration
export const AGENCY_SETTINGS_ACCESS_EMAILS = [
  'todd.conn@tcdsagency.com',
] as const;

// Routes restricted to intake team
export const INTAKE_RESTRICTED_ROUTES = [
  '/triage',
  '/leads',
  '/supervisor',
] as const;

// Helper functions
export function isIntakeTeamMember(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTAKE_TEAM_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
}

export function hasSupervisorAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERVISOR_ACCESS_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
}

export function hasAgencySettingsAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  return AGENCY_SETTINGS_ACCESS_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
}

export function isIntakeRestrictedRoute(pathname: string): boolean {
  return INTAKE_RESTRICTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );
}
