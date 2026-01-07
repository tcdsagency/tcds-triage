"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Link2, Bell, Shield, Database, RefreshCw, Save, Loader2, Check, AlertCircle, ExternalLink, Clock, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AgencySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [syncing, setSyncing] = useState<string | null>(null);
  
  const [agency, setAgency] = useState({
    name: "TCDS Insurance Agency",
    phone: "(205) 555-0100",
    email: "info@tcdsagency.com",
    address: "123 Main Street",
    city: "Birmingham",
    state: "AL",
    zip: "35203",
    website: "https://tcdsagency.com",
  });
  
  const [integrations, setIntegrations] = useState({
    hawksoft: { connected: true, lastSync: "2 minutes ago", status: "active" },
    agencyzoom: { connected: true, lastSync: "5 minutes ago", status: "active" },
    twilio: { connected: false, lastSync: null, status: "inactive" },
    openphone: { connected: false, lastSync: null, status: "inactive" },
  });

  const [afterHours, setAfterHours] = useState({
    enabled: true,
    timezone: "America/Chicago",
    businessHours: {
      monday: { open: "08:00", close: "17:00", closed: false },
      tuesday: { open: "08:00", close: "17:00", closed: false },
      wednesday: { open: "08:00", close: "17:00", closed: false },
      thursday: { open: "08:00", close: "17:00", closed: false },
      friday: { open: "08:00", close: "17:00", closed: false },
      saturday: { open: "", close: "", closed: true },
      sunday: { open: "", close: "", closed: true },
    },
    autoReplyMessage: "Thank you for contacting TCDS Insurance. We're currently closed but will return your call during business hours. For emergencies, please call 911 or your insurance carrier's 24/7 claims line.",
    cooldownHours: 4,
    holidaysEnabled: true,
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success && data.settings) {
          if (data.settings.agency) {
            setAgency({
              name: data.settings.agency.name || "",
              phone: data.settings.agency.phone || "",
              email: data.settings.agency.email || "",
              address: data.settings.agency.address?.street || "",
              city: data.settings.agency.address?.city || "",
              state: data.settings.agency.address?.state || "",
              zip: data.settings.agency.address?.zip || "",
              website: data.settings.agency.website || "",
            });
          }
          if (data.settings.afterHours) {
            setAfterHours(data.settings.afterHours);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency: {
            name: agency.name,
            phone: agency.phone,
            email: agency.email,
            website: agency.website,
            address: {
              street: agency.address,
              city: agency.city,
              state: agency.state,
              zip: agency.zip,
            },
          },
          afterHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (integration: string) => {
    setSyncing(integration);
    await new Promise(r => setTimeout(r, 2000));
    setSyncing(null);
  };

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "afterhours", label: "After Hours", icon: Moon },
    { id: "team", label: "Team", icon: Users },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  const teamMembers = [
    { id: 1, name: "Todd Conn", email: "todd.conn@tcdsagency.com", role: "Admin", status: "active" },
    { id: 2, name: "Sarah Smith", email: "sarah@tcdsagency.com", role: "Agent", status: "active" },
    { id: 3, name: "Mike Johnson", email: "mike@tcdsagency.com", role: "CSR", status: "active" },
    { id: 4, name: "Emily Davis", email: "emily@tcdsagency.com", role: "Agent", status: "invited" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agency Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your agency configuration and integrations</p>
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
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agency Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency Name</label>
                    <Input value={agency.name} onChange={(e) => setAgency({ ...agency, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <Input type="tel" value={agency.phone} onChange={(e) => setAgency({ ...agency, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <Input type="email" value={agency.email} onChange={(e) => setAgency({ ...agency, email: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Street Address</label>
                    <Input value={agency.address} onChange={(e) => setAgency({ ...agency, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <Input value={agency.city} onChange={(e) => setAgency({ ...agency, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                      <Input value={agency.state} onChange={(e) => setAgency({ ...agency, state: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ZIP</label>
                      <Input value={agency.zip} onChange={(e) => setAgency({ ...agency, zip: e.target.value })} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
                    <Input value={agency.website} onChange={(e) => setAgency({ ...agency, website: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Agency Logo</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <Button variant="outline" size="sm">Upload Logo</Button>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB. Recommended: 200x200px</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "afterhours" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">After Hours Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Configure business hours and after-hours auto-reply</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    afterHours.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  )}>
                    {afterHours.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>

              {/* Enable Toggle */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Enable After Hours Auto-Reply</div>
                    <div className="text-sm text-gray-500">Automatically send SMS replies when messages come in after hours</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={afterHours.enabled}
                    onChange={(e) => setAfterHours({ ...afterHours, enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone</label>
                <select
                  value={afterHours.timezone}
                  onChange={(e) => setAfterHours({ ...afterHours, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>

              {/* Business Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Business Hours</h3>
                <div className="space-y-2">
                  {(Object.entries(afterHours.businessHours) as [string, { open: string; close: string; closed: boolean }][]).map(([day, hours]) => (
                    <div key={day} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="w-24 font-medium text-gray-700 dark:text-gray-300 capitalize">{day}</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hours.closed}
                          onChange={(e) => setAfterHours({
                            ...afterHours,
                            businessHours: {
                              ...afterHours.businessHours,
                              [day]: { ...hours, closed: e.target.checked }
                            }
                          })}
                          className="w-4 h-4 rounded border-gray-300 text-gray-600"
                        />
                        <span className="text-sm text-gray-500">Closed</span>
                      </label>
                      {!hours.closed && (
                        <>
                          <input
                            type="time"
                            value={hours.open}
                            onChange={(e) => setAfterHours({
                              ...afterHours,
                              businessHours: {
                                ...afterHours.businessHours,
                                [day]: { ...hours, open: e.target.value }
                              }
                            })}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={hours.close}
                            onChange={(e) => setAfterHours({
                              ...afterHours,
                              businessHours: {
                                ...afterHours.businessHours,
                                [day]: { ...hours, close: e.target.value }
                              }
                            })}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Holidays */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Observe Major Holidays</div>
                    <div className="text-sm text-gray-500">Treat major US holidays (New Year's, Memorial Day, July 4th, Labor Day, Thanksgiving, Christmas) as after-hours</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={afterHours.holidaysEnabled}
                    onChange={(e) => setAfterHours({ ...afterHours, holidaysEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </div>

              {/* Auto-Reply Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Auto-Reply Message</label>
                <textarea
                  value={afterHours.autoReplyMessage}
                  onChange={(e) => setAfterHours({ ...afterHours, autoReplyMessage: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  placeholder="Enter the message to send when someone contacts you after hours..."
                />
                <p className="text-xs text-gray-500 mt-1">{afterHours.autoReplyMessage.length}/320 characters</p>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reply Cooldown</label>
                <div className="flex items-center gap-3">
                  <select
                    value={afterHours.cooldownHours}
                    onChange={(e) => setAfterHours({ ...afterHours, cooldownHours: parseInt(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={4}>4 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                  </select>
                  <span className="text-sm text-gray-500">Don't send another auto-reply to the same number within this time</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Users className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
              
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{member.role}</Badge>
                      {member.status === "invited" ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
                      )}
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connected Services</h2>
              
              <div className="space-y-4">
                {/* HawkSoft */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Database className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">HawkSoft</div>
                        <div className="text-sm text-gray-500">Agency Management System</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {integrations.hawksoft.connected ? (
                        <Badge className="bg-green-100 text-green-700">
                          <Check className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Connected</Badge>
                      )}
                    </div>
                  </div>
                  {integrations.hawksoft.connected && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500">Last sync: {integrations.hawksoft.lastSync}</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSync("hawksoft")}
                        disabled={syncing === "hawksoft"}
                      >
                        {syncing === "hawksoft" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Sync Now
                      </Button>
                    </div>
                  )}
                </div>

                {/* AgencyZoom */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">AgencyZoom</div>
                        <div className="text-sm text-gray-500">CRM & Lead Management</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {integrations.agencyzoom.connected ? (
                        <Badge className="bg-green-100 text-green-700">
                          <Check className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Connected</Badge>
                      )}
                    </div>
                  </div>
                  {integrations.agencyzoom.connected && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500">Last sync: {integrations.agencyzoom.lastSync}</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSync("agencyzoom")}
                        disabled={syncing === "agencyzoom"}
                      >
                        {syncing === "agencyzoom" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Sync Now
                      </Button>
                    </div>
                  )}
                </div>

                {/* Twilio */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-75">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Twilio</div>
                        <div className="text-sm text-gray-500">SMS & Voice</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>

                {/* OpenPhone */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-75">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">OpenPhone</div>
                        <div className="text-sm text-gray-500">Business Phone System</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agency Notifications</h2>
              <p className="text-sm text-gray-500">Configure notifications for the entire agency</p>
              
              <div className="space-y-3">
                {[
                  { label: "New Lead Alerts", desc: "Notify team when new leads come in" },
                  { label: "Policy Expiration Alerts", desc: "30-day expiration warnings" },
                  { label: "Claims Alerts", desc: "Notify when claims are filed" },
                  { label: "Payment Alerts", desc: "Notify on failed payments" },
                ].map((item, i) => (
                  <label key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                      <div className="text-sm text-gray-500">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Require 2FA for all users</div>
                      <div className="text-sm text-gray-500">All team members must enable two-factor authentication</div>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Session timeout</div>
                      <div className="text-sm text-gray-500">Automatically log out inactive users</div>
                    </div>
                    <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <option>30 minutes</option>
                      <option>1 hour</option>
                      <option>4 hours</option>
                      <option>8 hours</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">IP Allowlist</div>
                      <div className="text-sm text-gray-500">Restrict access to specific IP addresses</div>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "transition-colors",
                saved ? "bg-green-600 hover:bg-green-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
