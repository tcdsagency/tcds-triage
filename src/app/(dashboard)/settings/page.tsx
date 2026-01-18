import { redirect } from 'next/navigation';

/**
 * Settings Redirect
 * =================
 * The main settings hub has been merged into Agency Settings.
 * This page redirects to /agency-settings for backwards compatibility.
 */
export default function SettingsPage() {
  redirect('/agency-settings');
}
