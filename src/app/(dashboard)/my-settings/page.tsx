"use client";

import { useState, useEffect } from "react";
import { User, Bell, Moon, Sun, Shield, Key, Smartphone, Mail, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  extension: string | null;
  role: string;
  avatarUrl: string | null;
}

export default function MySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "Agent",
    extension: "",
    avatarUrl: "",
  });
  
  const [notifications, setNotifications] = useState({
    emailNewLead: true,
    emailPolicyExpiring: true,
    emailTaskAssigned: true,
    pushNewLead: true,
    pushIncomingCall: true,
    pushTaskDue: true,
    smsUrgent: false,
  });
  
  const [preferences, setPreferences] = useState({
    theme: "dark",
    defaultView: "dashboard",
    autoRefresh: true,
    soundAlerts: true,
  });

  // Fetch current user profile on load
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.user) {
          setProfile({
            firstName: data.user.firstName || "",
            lastName: data.user.lastName || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            title: data.user.role || "Agent",
            extension: data.user.extension || "",
            avatarUrl: data.user.avatarUrl || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          extension: profile.extension,
          avatarUrl: profile.avatarUrl || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "preferences", label: "Preferences", icon: Moon },
    { id: "security", label: "Security", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Loading your settings...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your personal preferences and account settings</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors",
                  activeTab === tab.id
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                    <Input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                    <Input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <Input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                    <Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Extension</label>
                    <Input value={profile.extension} onChange={(e) => setProfile({ ...profile, extension: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Profile Photo</h3>
                <div className="flex items-start gap-4">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={`${profile.firstName} ${profile.lastName}`}
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                      onError={(e) => {
                        // Hide broken image and show initials fallback
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={cn(
                    "w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl font-bold text-emerald-600 dark:text-emerald-400",
                    profile.avatarUrl ? "hidden" : ""
                  )}>
                    {profile.firstName?.[0] || ""}{profile.lastName?.[0] || ""}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Photo URL
                    </label>
                    <Input
                      type="url"
                      value={profile.avatarUrl}
                      onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                      placeholder="https://example.com/photo.jpg"
                      className="mb-2"
                    />
                    <p className="text-xs text-gray-500">
                      Enter a direct link to your profile photo (JPG, PNG)
                    </p>
                    {profile.avatarUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-red-600 hover:text-red-700"
                        onClick={() => setProfile({ ...profile, avatarUrl: "" })}
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Notifications</h2>
                <div className="space-y-3">
                  {[
                    { key: "emailNewLead", label: "New lead assigned", desc: "When a new lead is assigned to you" },
                    { key: "emailPolicyExpiring", label: "Policy expiring", desc: "When a customer's policy is expiring soon" },
                    { key: "emailTaskAssigned", label: "Task assigned", desc: "When a task is assigned to you" },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                        <div className="text-sm text-gray-500">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Push Notifications</h2>
                <div className="space-y-3">
                  {[
                    { key: "pushNewLead", label: "New leads", icon: User },
                    { key: "pushIncomingCall", label: "Incoming calls", icon: Smartphone },
                    { key: "pushTaskDue", label: "Task reminders", icon: Bell },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Display</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                    <div className="flex gap-3">
                      {[
                        { value: "light", label: "Light", icon: Sun },
                        { value: "dark", label: "Dark", icon: Moon },
                      ].map((theme) => (
                        <button
                          key={theme.value}
                          onClick={() => setPreferences({ ...preferences, theme: theme.value })}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                            preferences.theme === theme.value
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                          )}
                        >
                          <theme.icon className="w-4 h-4" />
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default View</label>
                    <select
                      value={preferences.defaultView}
                      onChange={(e) => setPreferences({ ...preferences, defaultView: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="dashboard">Dashboard</option>
                      <option value="triage">Triage Queue</option>
                      <option value="leads">Lead Queue</option>
                      <option value="customers">Customers</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Behavior</h2>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Auto-refresh data</div>
                      <div className="text-sm text-gray-500">Automatically refresh data every 30 seconds</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.autoRefresh}
                      onChange={(e) => setPreferences({ ...preferences, autoRefresh: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Sound alerts</div>
                      <div className="text-sm text-gray-500">Play sounds for notifications</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.soundAlerts}
                      onChange={(e) => setPreferences({ ...preferences, soundAlerts: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <Button variant="outline">Update Password</Button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h2>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">2FA Status</div>
                      <div className="text-sm text-gray-500">Add an extra layer of security</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Not Enabled</Badge>
                </div>
                <Button variant="outline" className="mt-3">Enable 2FA</Button>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sessions</h2>
                <p className="text-sm text-gray-500 mb-3">You're currently logged in on this device.</p>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">Sign Out All Devices</Button>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
