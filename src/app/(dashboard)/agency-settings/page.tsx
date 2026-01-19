"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Link2, Bell, Shield, Database, RefreshCw, Save, Loader2, Check, CheckCircle, AlertCircle, ExternalLink, Clock, Moon, Plus, X, Phone, Mail, Edit2, Trash2, Key, Eye, EyeOff, Zap, Settings2, MessageSquare, Webhook, Copy, Cpu, TrendingUp, DollarSign, BarChart3, Server, Activity } from "lucide-react";
import { BridgeStatus } from "@/components/features/settings/BridgeStatus";
import { CallMonitor } from "@/components/features/settings/CallMonitor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FEATURES, getFeaturesByCategory, getDefaultPermissions } from "@/lib/feature-permissions";

export default function AgencySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [syncing, setSyncing] = useState<string | null>(null);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "agent",
    extension: "",
    directDial: "",
    cellPhone: "",
    agencyzoomId: "",
    agentCode: "",
    inLeadRotation: true,
    avatarUrl: "",
    featurePermissions: getDefaultPermissions(),
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordResetting, setPasswordResetting] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  const [agency, setAgency] = useState({
    name: "TCDS Insurance Agency",
    phone: "(205) 847-5616",
    email: "agency@tcdsagency.com",
    address: "PO BOX 1283",
    city: "Pinson",
    state: "AL",
    zip: "35126",
    website: "https://tcdsagency.com",
  });
  
  const [integrations, setIntegrations] = useState({
    hawksoft: { connected: true, lastSync: "2 minutes ago", status: "active" },
    agencyzoom: { connected: true, lastSync: "5 minutes ago", status: "active" },
    twilio: { connected: false, lastSync: null, status: "inactive" },
    openphone: { connected: false, lastSync: null, status: "inactive" },
  });

  // Integration settings state
  const [integrationsData, setIntegrationsData] = useState<any[]>([]);
  const [integrationsGrouped, setIntegrationsGrouped] = useState<any[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [integrationFormData, setIntegrationFormData] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [savingIntegration, setSavingIntegration] = useState(false);

  // SMS Templates state
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", category: "general", content: "" });
  const [templateSaving, setTemplateSaving] = useState(false);

  // Webhooks state
  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [webhookForm, setWebhookForm] = useState({ name: "", url: "", events: [] as string[] });
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  // API Keys state
  const [apiKeysList, setApiKeysList] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({ name: "", permissions: ["read"] });
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  // AI Usage state
  const [aiUsage, setAiUsage] = useState<any>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiUsagePeriod, setAiUsagePeriod] = useState("30d");

  // Data Sync state
  const [dataSyncStats, setDataSyncStats] = useState<{
    hawksoft: { lastSync: string | null; policiesSynced: number; status: string };
    agencyzoom: { lastSync: string | null; customersSynced: number; status: string };
  } | null>(null);
  const [dataSyncLoading, setDataSyncLoading] = useState(false);
  const [hawksoftSyncing, setHawksoftSyncing] = useState(false);
  const [hawksoftSyncResult, setHawksoftSyncResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [agencyzoomSyncing, setAgencyzoomSyncing] = useState(false);
  const [agencyzoomSyncResult, setAgencyzoomSyncResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // JSON Import state
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");

  // Logo upload state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [jsonImportLoading, setJsonImportLoading] = useState(false);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);

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
            if (data.settings.agency.logoUrl) {
              setLogoUrl(data.settings.agency.logoUrl);
            }
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

  // Load integrations data
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const res = await fetch("/api/integrations");
        const data = await res.json();
        if (data.success) {
          setIntegrationsData(data.integrations);
          setIntegrationsGrouped(data.grouped);
        }
      } catch (err) {
        console.error("Failed to load integrations:", err);
      } finally {
        setIntegrationsLoading(false);
      }
    };
    loadIntegrations();
  }, []);

  // Load SMS Templates when tab is active
  useEffect(() => {
    if (activeTab === "templates" && smsTemplates.length === 0) {
      const loadTemplates = async () => {
        setTemplatesLoading(true);
        try {
          const res = await fetch("/api/sms-templates");
          const data = await res.json();
          if (data.success) setSmsTemplates(data.templates);
        } catch (err) {
          console.error("Failed to load templates:", err);
        } finally {
          setTemplatesLoading(false);
        }
      };
      loadTemplates();
    }
  }, [activeTab]);

  // Load Webhooks when tab is active
  useEffect(() => {
    if (activeTab === "webhooks" && webhooksList.length === 0) {
      const loadWebhooks = async () => {
        setWebhooksLoading(true);
        try {
          const res = await fetch("/api/webhooks");
          const data = await res.json();
          if (data.success) {
            setWebhooksList(data.webhooks);
            setWebhookEvents(data.availableEvents || []);
          }
        } catch (err) {
          console.error("Failed to load webhooks:", err);
        } finally {
          setWebhooksLoading(false);
        }
      };
      loadWebhooks();
    }
  }, [activeTab]);

  // Load API Keys when tab is active
  useEffect(() => {
    if (activeTab === "apikeys" && apiKeysList.length === 0) {
      const loadApiKeys = async () => {
        setApiKeysLoading(true);
        try {
          const res = await fetch("/api/api-keys");
          const data = await res.json();
          if (data.success) setApiKeysList(data.apiKeys);
        } catch (err) {
          console.error("Failed to load API keys:", err);
        } finally {
          setApiKeysLoading(false);
        }
      };
      loadApiKeys();
    }
  }, [activeTab]);

  // Load AI Usage when tab is active
  useEffect(() => {
    if (activeTab === "aiusage") {
      const loadAiUsage = async () => {
        setAiUsageLoading(true);
        try {
          const res = await fetch(`/api/ai/token-usage?period=${aiUsagePeriod}`);
          const data = await res.json();
          if (data.success) setAiUsage(data);
        } catch (err) {
          console.error("Failed to load AI usage:", err);
        } finally {
          setAiUsageLoading(false);
        }
      };
      loadAiUsage();
    }
  }, [activeTab, aiUsagePeriod]);

  // SMS Template handlers
  const handleSaveTemplate = async () => {
    setTemplateSaving(true);
    try {
      const method = editingTemplate ? "PUT" : "POST";
      const body = editingTemplate ? { id: editingTemplate.id, ...templateForm } : templateForm;
      const res = await fetch("/api/sms-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (editingTemplate) {
          setSmsTemplates(smsTemplates.map(t => t.id === editingTemplate.id ? data.template : t));
        } else {
          setSmsTemplates([data.template, ...smsTemplates]);
        }
        setShowTemplateModal(false);
        setEditingTemplate(null);
        setTemplateForm({ name: "", category: "general", content: "" });
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/sms-templates?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) setSmsTemplates(smsTemplates.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  // Webhook handlers
  const handleSaveWebhook = async () => {
    setWebhookSaving(true);
    try {
      const method = editingWebhook ? "PUT" : "POST";
      const body = editingWebhook ? { id: editingWebhook.id, ...webhookForm } : webhookForm;
      const res = await fetch("/api/webhooks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (editingWebhook) {
          setWebhooksList(webhooksList.map(w => w.id === editingWebhook.id ? data.webhook : w));
        } else {
          setWebhooksList([data.webhook, ...webhooksList]);
          if (data.webhook.secret) setNewWebhookSecret(data.webhook.secret);
        }
        setShowWebhookModal(false);
        setEditingWebhook(null);
        setWebhookForm({ name: "", url: "", events: [] });
      }
    } catch (err) {
      console.error("Failed to save webhook:", err);
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) setWebhooksList(webhooksList.filter(w => w.id !== id));
    } catch (err) {
      console.error("Failed to delete webhook:", err);
    }
  };

  // API Key handlers
  const handleCreateApiKey = async () => {
    setApiKeySaving(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKeyForm),
      });
      const data = await res.json();
      if (data.success) {
        setApiKeysList([data.apiKey, ...apiKeysList]);
        setNewApiKey(data.apiKey.key);
        setShowApiKeyModal(false);
        setApiKeyForm({ name: "", permissions: ["read"] });
      }
    } catch (err) {
      console.error("Failed to create API key:", err);
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) setApiKeysList(apiKeysList.map(k => k.id === id ? { ...k, isActive: false, revokedAt: new Date().toISOString() } : k));
    } catch (err) {
      console.error("Failed to revoke API key:", err);
    }
  };

  // Open integration config modal
  const handleConfigureIntegration = (integration: any) => {
    setEditingIntegration(integration);
    setIntegrationFormData({});
    setShowPasswords({});
    setTestResult(null);
  };

  // Test integration connection
  const handleTestIntegration = async (integrationId: string, credentials?: Record<string, string>) => {
    setTestingIntegration(integrationId);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, credentials }),
      });
      const data = await res.json();
      setTestResult({ id: integrationId, success: data.success, message: data.message });
    } catch (err) {
      setTestResult({ id: integrationId, success: false, message: "Test failed" });
    } finally {
      setTestingIntegration(null);
    }
  };

  // Save integration credentials
  const handleSaveIntegration = async () => {
    if (!editingIntegration) return;
    setSavingIntegration(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: editingIntegration.id,
          credentials: integrationFormData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Reload integrations
        const reloadRes = await fetch("/api/integrations");
        const reloadData = await reloadRes.json();
        if (reloadData.success) {
          setIntegrationsData(reloadData.integrations);
          setIntegrationsGrouped(reloadData.grouped);
        }
        setEditingIntegration(null);
      }
    } catch (err) {
      console.error("Failed to save integration:", err);
    } finally {
      setSavingIntegration(false);
    }
  };

  // Import credentials from JSON
  const handleJsonImport = async () => {
    setJsonImportError(null);
    setJsonImportLoading(true);
    try {
      const parsed = JSON.parse(jsonImportText);

      // Map common env var names to integration IDs
      const keyMapping: Record<string, { integration: string; field: string }> = {
        // OpenAI
        OPENAI_API_KEY: { integration: "openai", field: "apiKey" },
        AI_INTEGRATIONS_OPENAI_API_KEY: { integration: "openai", field: "apiKey" },
        AI_INTEGRATIONS_OPENAI_BASE_URL: { integration: "openai", field: "baseUrl" },
        // Anthropic
        ANTHROPIC_API_KEY: { integration: "anthropic", field: "apiKey" },
        AI_INTEGRATIONS_ANTHROPIC_API_KEY: { integration: "anthropic", field: "apiKey" },
        AI_INTEGRATIONS_ANTHROPIC_BASE_URL: { integration: "anthropic", field: "baseUrl" },
        // Twilio
        TWILIO_ACCOUNT_SID: { integration: "twilio", field: "accountSid" },
        TWILIO_AUTH_TOKEN: { integration: "twilio", field: "authToken" },
        TWILIO_PHONE_NUMBER: { integration: "twilio", field: "phoneNumber" },
        // Resend
        RESEND_API_KEY: { integration: "resend", field: "apiKey" },
        // AgencyZoom
        AGENCYZOOM_API_USERNAME: { integration: "agencyzoom", field: "username" },
        AGENCYZOOM_API_PASSWORD: { integration: "agencyzoom", field: "password" },
        // HawkSoft
        HAWKSOFT_API_KEY: { integration: "hawksoft", field: "apiKey" },
        HAWKSOFT_AGENCY_ID: { integration: "hawksoft", field: "agencyId" },
        HAWKSOFT_CLIENT_ID: { integration: "hawksoft", field: "clientId" },
        HAWKSOFT_CLIENT_SECRET: { integration: "hawksoft", field: "clientSecret" },
        HAWKSOFT_USERNAME: { integration: "hawksoft", field: "username" },
        HAWKSOFT_PASSWORD: { integration: "hawksoft", field: "password" },
        // Deepgram
        DEEPGRAM_API_KEY: { integration: "deepgram", field: "apiKey" },
        // Nearmap
        NEARMAP_API_KEY: { integration: "nearmap", field: "apiKey" },
        // Google
        GOOGLE_API_KEY: { integration: "google", field: "apiKey" },
        GOOGLE_MAPS_API_KEY: { integration: "google", field: "apiKey" },
        // Canopy
        CANOPY_CLIENT_ID: { integration: "canopy", field: "clientId" },
        CANOPY_CLIENT_SECRET: { integration: "canopy", field: "clientSecret" },
        CANOPY_ENVIRONMENT: { integration: "canopy", field: "environment" },
        // 3CX
        THREECX_API_KEY: { integration: "3cx", field: "apiKey" },
        THREECX_BASE_URL: { integration: "3cx", field: "baseUrl" },
        THREECX_JWT_PUBLIC_KEY: { integration: "3cx", field: "jwtPublicKey" },
        // SmartyStreets
        SMARTY_AUTH_ID: { integration: "smarty", field: "authId" },
        SMARTY_AUTH_TOKEN: { integration: "smarty", field: "authToken" },
        // HasData
        HASDATA_API_KEY: { integration: "hasdata", field: "apiKey" },
        // MSSQL (for 3CX recordings)
        MSSQL_SERVER: { integration: "mssql", field: "server" },
        MSSQL_DATABASE: { integration: "mssql", field: "database" },
        MSSQL_USER: { integration: "mssql", field: "user" },
        MSSQL_PASSWORD: { integration: "mssql", field: "password" },
        // Neptune
        NEPTUNE_SECRET: { integration: "neptune", field: "secret" },
        NEPTUNE_SOURCE: { integration: "neptune", field: "source" },
        // Delphi
        DELPHI_AUTH_TOKEN: { integration: "delphi", field: "authToken" },
      };

      // Group credentials by integration
      const integrationCredentials: Record<string, Record<string, string>> = {};

      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") continue;
        const mapping = keyMapping[key];
        if (mapping) {
          if (!integrationCredentials[mapping.integration]) {
            integrationCredentials[mapping.integration] = {};
          }
          integrationCredentials[mapping.integration][mapping.field] = value;
        }
      }

      // Save each integration
      let savedCount = 0;
      for (const [integrationId, credentials] of Object.entries(integrationCredentials)) {
        const res = await fetch("/api/integrations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ integrationId, credentials }),
        });
        if (res.ok) savedCount++;
      }

      // Reload integrations
      const reloadRes = await fetch("/api/integrations");
      const reloadData = await reloadRes.json();
      if (reloadData.success) {
        setIntegrationsData(reloadData.integrations);
        setIntegrationsGrouped(reloadData.grouped);
      }

      setShowJsonImport(false);
      setJsonImportText("");
      alert(`Successfully imported ${savedCount} integration(s)`);
    } catch (err: any) {
      setJsonImportError(err.message || "Invalid JSON format");
    } finally {
      setJsonImportLoading(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setLogoUploading(true);
    try {
      // Convert to base64 for simple storage (could use object storage for production)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // Save to settings
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agency: {
              ...agency,
              logoUrl: base64,
            },
          }),
        });

        if (res.ok) {
          setLogoUrl(base64);
        } else {
          alert('Failed to upload logo');
        }
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('Failed to upload logo');
      setLogoUploading(false);
    }
  };

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

  // Load data sync stats
  const loadDataSyncStats = async () => {
    setDataSyncLoading(true);
    try {
      const res = await fetch("/api/sync/stats");
      const data = await res.json();
      if (data.success) {
        setDataSyncStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load sync stats:", err);
    } finally {
      setDataSyncLoading(false);
    }
  };

  // Handle HawkSoft sync
  const handleHawksoftSync = async () => {
    setHawksoftSyncing(true);
    setHawksoftSyncResult(null);

    try {
      const res = await fetch("/api/sync/hawksoft", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setHawksoftSyncResult({
          success: true,
          message: `Synced ${data.policiesSynced} policies from ${data.customersUpdated} customers`,
          details: data,
        });
        // Reload stats after sync
        await loadDataSyncStats();
      } else {
        setHawksoftSyncResult({
          success: false,
          message: data.error || "Sync failed",
          details: data,
        });
      }
    } catch (err: any) {
      setHawksoftSyncResult({
        success: false,
        message: err.message || "Sync failed",
      });
    } finally {
      setHawksoftSyncing(false);
    }
  };

  // Handle AgencyZoom sync
  const handleAgencyZoomSync = async () => {
    setAgencyzoomSyncing(true);
    setAgencyzoomSyncResult(null);

    try {
      const res = await fetch("/api/sync/agencyzoom", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setAgencyzoomSyncResult({
          success: true,
          message: `Synced ${data.customersCreated || 0} new customers, updated ${data.customersUpdated || 0}`,
          details: data,
        });
        // Reload stats after sync
        await loadDataSyncStats();
      } else {
        setAgencyzoomSyncResult({
          success: false,
          message: data.error || "Sync failed",
          details: data,
        });
      }
    } catch (err: any) {
      setAgencyzoomSyncResult({
        success: false,
        message: err.message || "Sync failed",
      });
    } finally {
      setAgencyzoomSyncing(false);
    }
  };

  // Load sync stats when data sync tab is active
  useEffect(() => {
    if (activeTab === "datasync" && !dataSyncStats) {
      loadDataSyncStats();
    }
  }, [activeTab]);

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "afterhours", label: "After Hours", icon: Moon },
    { id: "team", label: "Team", icon: Users },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "datasync", label: "Data Sync", icon: Database },
    { id: "aiusage", label: "AI Usage", icon: Cpu },
    { id: "templates", label: "SMS Templates", icon: MessageSquare },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "bridge", label: "VM Bridge", icon: Server },
    { id: "callmonitor", label: "Call Monitor", icon: Activity },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  // Fetch team members function
  const fetchTeamMembers = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch("/api/users?active=true");
      const data = await res.json();
      if (data.success) {
        setTeamMembers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setTeamLoading(false);
    }
  };

  // Load team members when tab changes to team
  useEffect(() => {
    if (activeTab === "team" && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [activeTab]);

  // Open add user modal
  const handleAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "agent",
      extension: "",
      directDial: "",
      cellPhone: "",
      agencyzoomId: "",
      agentCode: "",
      inLeadRotation: true,
      avatarUrl: "",
      featurePermissions: getDefaultPermissions(),
    });
    setUserError(null);
    setNewPassword("");
    setPasswordResetSuccess(false);
    setShowUserModal(true);
  };

  // Open edit user modal
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "agent",
      extension: user.extension || "",
      directDial: user.directDial || "",
      cellPhone: user.cellPhone || "",
      agencyzoomId: user.agencyzoomId || "",
      agentCode: user.agentCode || "",
      inLeadRotation: user.inLeadRotation ?? true,
      avatarUrl: user.avatarUrl || "",
      featurePermissions: user.featurePermissions || getDefaultPermissions(),
    });
    setUserError(null);
    setNewPassword("");
    setPasswordResetSuccess(false);
    setShowUserModal(true);
  };

  // Save user (create or update)
  const handleSaveUser = async () => {
    setUserSaving(true);
    setUserError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userFormData),
      });

      const data = await res.json();

      if (data.success) {
        setShowUserModal(false);
        fetchTeamMembers();
      } else {
        setUserError(data.error || "Failed to save user");
      }
    } catch (err) {
      setUserError("Failed to save user");
    } finally {
      setUserSaving(false);
    }
  };

  // Reset user password (admin only)
  const handleResetPassword = async () => {
    if (!editingUser || !newPassword) return;

    setPasswordResetting(true);
    setUserError(null);
    setPasswordResetSuccess(false);

    try {
      const res = await fetch(`/api/users/${editingUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setPasswordResetSuccess(true);
        setNewPassword("");
        setTimeout(() => setPasswordResetSuccess(false), 3000);
      } else {
        setUserError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setUserError("Failed to reset password");
    } finally {
      setPasswordResetting(false);
    }
  };

  // Deactivate user
  const handleDeactivateUser = async (user: any) => {
    if (!confirm(`Are you sure you want to deactivate ${user.name}?`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchTeamMembers();
      }
    } catch (err) {
      console.error("Failed to deactivate user:", err);
    }
  };

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
                  <div className="w-24 h-24 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Agency Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <label htmlFor="logo-upload">
                      <Button variant="outline" size="sm" asChild disabled={logoUploading}>
                        <span className="cursor-pointer">
                          {logoUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            logoUrl ? "Change Logo" : "Upload Logo"
                          )}
                        </span>
                      </Button>
                    </label>
                    {logoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 text-red-500 hover:text-red-600"
                        onClick={() => setLogoUrl(null)}
                      >
                        Remove
                      </Button>
                    )}
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 resize-none"
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
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900"
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
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddUser}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Team Member
                </Button>
              </div>

              {/* Cross-System ID Legend */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                <div className="font-medium text-blue-800 dark:text-blue-200 mb-2">Cross-System ID Mapping</div>
                <div className="grid grid-cols-3 gap-2 text-blue-700 dark:text-blue-300">
                  <div><span className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">Ext</span> = 3CX Phone</div>
                  <div><span className="font-mono bg-purple-100 dark:bg-purple-800 px-1 rounded">AZ</span> = AgencyZoom CSR</div>
                  <div><span className="font-mono bg-amber-100 dark:bg-amber-800 px-1 rounded">HS</span> = HawkSoft Code</div>
                </div>
              </div>

              {teamLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No team members yet</p>
                  <Button size="sm" className="mt-4" onClick={handleAddUser}>Add First Team Member</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {member.initials || "??"}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{member.name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {member.email}
                            </div>
                            {member.phone && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {member.phone}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{member.role}</Badge>
                          {member.isActive ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>
                          )}
                        </div>
                      </div>

                      {/* Cross-System IDs */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap">
                        {member.extension && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-mono text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-1.5 py-0.5 rounded">Ext</span>
                            <span className="text-gray-700 dark:text-gray-300 font-mono">{member.extension}</span>
                          </div>
                        )}
                        {member.agencyzoomId && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-mono text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 px-1.5 py-0.5 rounded">AZ</span>
                            <span className="text-gray-700 dark:text-gray-300 font-mono">{member.agencyzoomId}</span>
                          </div>
                        )}
                        {member.agentCode && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-mono text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-1.5 py-0.5 rounded">HS</span>
                            <span className="text-gray-700 dark:text-gray-300 font-mono">{member.agentCode}</span>
                          </div>
                        )}
                        {!member.extension && !member.agencyzoomId && !member.agentCode && (
                          <span className="text-sm text-gray-400 italic">No cross-system IDs configured</span>
                        )}

                        <div className="ml-auto flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(member)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeactivateUser(member)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Integration Settings</h2>
                  <p className="text-sm text-gray-500">Configure API keys and credentials for external services</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowJsonImport(true)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Import from JSON
                </Button>
              </div>

              {/* JSON Import Modal */}
              {showJsonImport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white text-gray-900 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Import Credentials from JSON</h3>
                      <button onClick={() => setShowJsonImport(false)}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Paste a JSON object with your environment variables. Supported keys:
                      AI_INTEGRATIONS_OPENAI_*, AI_INTEGRATIONS_ANTHROPIC_*, TWILIO_*, RESEND_*, AGENCYZOOM_*, HAWKSOFT_*, DEEPGRAM_*, NEARMAP_*, GOOGLE_*, CANOPY_*, THREECX_*, SMARTY_*, HASDATA_*, MSSQL_*, NEPTUNE_*, DELPHI_*
                    </p>
                    <textarea
                      value={jsonImportText}
                      onChange={(e) => setJsonImportText(e.target.value)}
                      placeholder={'{\n  "OPENAI_API_KEY": "sk-...",\n  "ANTHROPIC_API_KEY": "sk-ant-...",\n  "TWILIO_ACCOUNT_SID": "AC...",\n  "TWILIO_AUTH_TOKEN": "..."\n}'}
                      className="w-full h-64 p-3 font-mono text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                    />
                    {jsonImportError && (
                      <p className="text-red-500 text-sm mt-2">{jsonImportError}</p>
                    )}
                    <div className="flex justify-end gap-3 mt-4">
                      <Button variant="outline" onClick={() => setShowJsonImport(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleJsonImport} disabled={jsonImportLoading || !jsonImportText.trim()}>
                        {jsonImportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Import Credentials
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {integrationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-8">
                  {integrationsGrouped.map((group) => (
                    <div key={group.category}>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{group.category}</h3>
                      <div className="space-y-3">
                        {group.integrations.map((integration: any) => (
                          <div
                            key={integration.id}
                            className={cn(
                              "p-4 border rounded-lg transition-colors",
                              integration.isConfigured
                                ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                                : "border-gray-200 dark:border-gray-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center",
                                  integration.isConfigured
                                    ? "bg-green-100 dark:bg-green-900/30"
                                    : "bg-gray-100 dark:bg-gray-800"
                                )}>
                                  <Key className={cn(
                                    "w-5 h-5",
                                    integration.isConfigured ? "text-green-600" : "text-gray-400"
                                  )} />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{integration.name}</div>
                                  <div className="text-sm text-gray-500">{integration.description}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {integration.isConfigured ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Check className="w-3 h-3 mr-1" />
                                    {integration.configSource === "environment" ? "Configured (env)" : "Configured"}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Not Configured</Badge>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleConfigureIntegration(integration)}
                                >
                                  <Settings2 className="w-4 h-4 mr-2" />
                                  Configure
                                </Button>
                                {integration.isConfigured && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTestIntegration(integration.id)}
                                    disabled={testingIntegration === integration.id}
                                  >
                                    {testingIntegration === integration.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Zap className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Show test result */}
                            {testResult && testResult.id === integration.id && (
                              <div className={cn(
                                "mt-3 p-2 rounded text-sm",
                                testResult.success
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              )}>
                                {testResult.success ? <Check className="w-4 h-4 inline mr-2" /> : <AlertCircle className="w-4 h-4 inline mr-2" />}
                                {testResult.message}
                              </div>
                            )}

                            {/* Show configured fields */}
                            {integration.isConfigured && integration.configSource === "database" && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex flex-wrap gap-3">
                                  {integration.fields.map((field: any) => (
                                    <div key={field.key} className="text-xs">
                                      <span className="text-gray-500">{field.label}:</span>
                                      <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">
                                        {integration.values[field.key]?.isSet ? integration.values[field.key].maskedValue : "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Configure Integration Modal */}
              {editingIntegration && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                    <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Configure {editingIntegration.name}
                        </h3>
                        <p className="text-sm text-gray-500">{editingIntegration.description}</p>
                      </div>
                      <button
                        onClick={() => setEditingIntegration(null)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      {editingIntegration.fields.map((field: any) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <div className="relative">
                            <input
                              type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                              value={integrationFormData[field.key] || ""}
                              onChange={(e) => setIntegrationFormData({
                                ...integrationFormData,
                                [field.key]: e.target.value,
                              })}
                              placeholder={field.placeholder || (editingIntegration.values[field.key]?.isSet ? editingIntegration.values[field.key].maskedValue : "")}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                            {field.type === "password" && (
                              <button
                                type="button"
                                onClick={() => setShowPasswords({
                                  ...showPasswords,
                                  [field.key]: !showPasswords[field.key],
                                })}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                          {editingIntegration.values[field.key]?.isSet && (
                            <p className="mt-1 text-xs text-gray-500">
                              Current: {editingIntegration.values[field.key].maskedValue}
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Test result in modal */}
                      {testResult && testResult.id === editingIntegration.id && (
                        <div className={cn(
                          "p-3 rounded-lg text-sm",
                          testResult.success
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {testResult.success ? <Check className="w-4 h-4 inline mr-2" /> : <AlertCircle className="w-4 h-4 inline mr-2" />}
                          {testResult.message}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
                      <Button
                        variant="outline"
                        onClick={() => handleTestIntegration(editingIntegration.id, integrationFormData)}
                        disabled={testingIntegration === editingIntegration.id}
                      >
                        {testingIntegration === editingIntegration.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setEditingIntegration(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveIntegration}
                          disabled={savingIntegration}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {savingIntegration ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "bridge" && (
            <BridgeStatus />
          )}

          {activeTab === "callmonitor" && (
            <CallMonitor />
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

          {/* SMS Templates Tab */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SMS Templates</h2>
                <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: "", category: "general", content: "" }); setShowTemplateModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> New Template
                </Button>
              </div>

              {templatesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : smsTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No templates yet. Create your first template to get started.</div>
              ) : (
                <div className="space-y-3">
                  {smsTemplates.map((template) => (
                    <div key={template.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{template.name}</span>
                            <Badge variant="outline" className="text-xs">{template.category}</Badge>
                            {template.usageCount > 0 && (
                              <span className="text-xs text-gray-500">Used {template.usageCount}x</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{template.content}</p>
                          {template.variables?.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {template.variables.map((v: string) => (
                                <span key={v} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{`{{${v}}}`}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(template); setTemplateForm({ name: template.name, category: template.category, content: template.content }); setShowTemplateModal(true); }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
                <Button onClick={() => { setEditingWebhook(null); setWebhookForm({ name: "", url: "", events: [] }); setShowWebhookModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> New Webhook
                </Button>
              </div>

              {newWebhookSecret && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-800 dark:text-amber-200">Save your webhook secret</div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">This will only be shown once. Use it to verify webhook signatures.</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 rounded text-xs font-mono">{newWebhookSecret}</code>
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newWebhookSecret); }}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewWebhookSecret(null)}>Dismiss</Button>
                    </div>
                  </div>
                </div>
              )}

              {webhooksLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : webhooksList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No webhooks configured. Create one to receive real-time event notifications.</div>
              ) : (
                <div className="space-y-3">
                  {webhooksList.map((webhook) => (
                    <div key={webhook.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{webhook.name}</span>
                            <Badge variant={webhook.isActive ? "default" : "secondary"} className="text-xs">
                              {webhook.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">{webhook.url}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(webhook.events as string[])?.map((event: string) => (
                              <span key={event} className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{event}</span>
                            ))}
                          </div>
                          {webhook.lastTriggeredAt && (
                            <p className="text-xs text-gray-500 mt-2">Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingWebhook(webhook); setWebhookForm({ name: webhook.name, url: webhook.url, events: webhook.events || [] }); setShowWebhookModal(true); }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === "apikeys" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h2>
                <Button onClick={() => { setApiKeyForm({ name: "", permissions: ["read"] }); setShowApiKeyModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> New API Key
                </Button>
              </div>

              {newApiKey && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-green-800 dark:text-green-200">API Key Created</div>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">Copy this key now. It will not be shown again.</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="px-2 py-1 bg-green-100 dark:bg-green-900/40 rounded text-xs font-mono break-all">{newApiKey}</code>
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newApiKey); }}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewApiKey(null)}>Dismiss</Button>
                    </div>
                  </div>
                </div>
              )}

              {apiKeysLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : apiKeysList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No API keys created. Create one to access the API programmatically.</div>
              ) : (
                <div className="space-y-3">
                  {apiKeysList.map((key) => (
                    <div key={key.id} className={cn("p-4 rounded-lg", key.revokedAt ? "bg-red-50 dark:bg-red-900/10" : "bg-gray-50 dark:bg-gray-900")}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{key.name}</span>
                            <Badge variant={key.revokedAt ? "destructive" : key.isActive ? "default" : "secondary"} className="text-xs">
                              {key.revokedAt ? "Revoked" : key.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{key.keyPrefix}...****</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(key.permissions as string[])?.map((perm: string) => (
                              <span key={perm} className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">{perm}</span>
                            ))}
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500 mt-2">
                            <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                            {key.lastUsedAt && <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                            {key.usageCount > 0 && <span>Used {key.usageCount}x</span>}
                          </div>
                        </div>
                        {!key.revokedAt && (
                          <Button variant="ghost" size="sm" onClick={() => handleRevokeApiKey(key.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data Sync Tab */}
          {activeTab === "datasync" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Synchronization</h2>
                <p className="text-sm text-gray-500">Sync policy and customer data from external systems</p>
              </div>

              {dataSyncLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* HawkSoft Sync Card */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Database className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">HawkSoft Policy Sync</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Sync policies from HawkSoft to update LOB types, carriers, and coverage details
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>
                                Last sync: {dataSyncStats?.hawksoft?.lastSync
                                  ? new Date(dataSyncStats.hawksoft.lastSync).toLocaleString()
                                  : "Never"}
                              </span>
                            </div>
                            {dataSyncStats?.hawksoft?.policiesSynced !== undefined && (
                              <div className="text-gray-500">
                                {dataSyncStats.hawksoft.policiesSynced.toLocaleString()} policies synced
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleHawksoftSync}
                        disabled={hawksoftSyncing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {hawksoftSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Sync Result */}
                    {hawksoftSyncResult && (
                      <div className={cn(
                        "mt-4 p-4 rounded-lg",
                        hawksoftSyncResult.success
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                      )}>
                        <div className="flex items-start gap-3">
                          {hawksoftSyncResult.success ? (
                            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                          )}
                          <div>
                            <p className={cn(
                              "font-medium",
                              hawksoftSyncResult.success
                                ? "text-green-800 dark:text-green-300"
                                : "text-red-800 dark:text-red-300"
                            )}>
                              {hawksoftSyncResult.success ? "Sync Completed" : "Sync Failed"}
                            </p>
                            <p className={cn(
                              "text-sm mt-1",
                              hawksoftSyncResult.success
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            )}>
                              {hawksoftSyncResult.message}
                            </p>
                            {hawksoftSyncResult.details?.hasMore && (
                              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                                More records available. Click "Sync Now" again to continue syncing.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          <p className="font-medium">Why sync?</p>
                          <p className="mt-1">
                            Running a sync will update policy Line of Business (LOB) types from HawkSoft.
                            This fixes policies showing as "Other" instead of their correct type (Auto, Home, etc.).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AgencyZoom Sync Card */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">AgencyZoom Customer Sync</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Sync customer and lead data from AgencyZoom
                          </p>
                          <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span>
                              Last sync: {dataSyncStats?.agencyzoom?.lastSync
                                ? new Date(dataSyncStats.agencyzoom.lastSync).toLocaleString()
                                : "Never"}
                            </span>
                          </div>
                          {dataSyncStats?.agencyzoom?.customersSynced !== undefined && (
                            <div className="text-gray-500 text-sm mt-1">
                              {dataSyncStats.agencyzoom.customersSynced.toLocaleString()} customers synced
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={handleAgencyZoomSync}
                        disabled={agencyzoomSyncing}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {agencyzoomSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    </div>
                    {agencyzoomSyncResult && (
                      <div className={cn(
                        "mt-4 p-3 rounded-lg text-sm",
                        agencyzoomSyncResult.success
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      )}>
                        {agencyzoomSyncResult.success ? (
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                        ) : (
                          <AlertCircle className="w-4 h-4 inline mr-2" />
                        )}
                        {agencyzoomSyncResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Usage Tab */}
          {activeTab === "aiusage" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Token Usage</h2>
                <select
                  value={aiUsagePeriod}
                  onChange={(e) => setAiUsagePeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 text-sm"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {aiUsageLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : !aiUsage ? (
                <div className="text-center py-8 text-gray-500">No AI usage data available yet. Usage will be tracked as AI features are used.</div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">Total Requests</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{aiUsage.totals?.requests?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm text-purple-700 dark:text-purple-300">Total Tokens</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{(aiUsage.totals?.totalTokens || 0).toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-700 dark:text-green-300">Est. Cost</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">${(aiUsage.totals?.estimatedCost || 0).toFixed(2)}</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <span className="text-sm text-red-700 dark:text-red-300">Errors</span>
                      </div>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-100">{aiUsage.totals?.errors || 0}</div>
                    </div>
                  </div>

                  {/* Usage by Provider */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Usage by Provider</h3>
                    <div className="space-y-3">
                      {aiUsage.byProvider?.map((provider: any) => (
                        <div key={provider.provider} className="flex items-center gap-4">
                          <div className="w-24 flex items-center gap-2">
                            <span className={cn("w-3 h-3 rounded-full", provider.provider === "openai" ? "bg-green-500" : provider.provider === "anthropic" ? "bg-orange-500" : "bg-blue-500")} />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{provider.provider}</span>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", provider.provider === "openai" ? "bg-green-500" : provider.provider === "anthropic" ? "bg-orange-500" : "bg-blue-500")}
                                style={{ width: `${(provider.totalTokens / (aiUsage.totals?.totalTokens || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-32 text-right">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{provider.totalTokens?.toLocaleString()}</span>
                            <span className="text-xs text-gray-500 ml-1">tokens</span>
                          </div>
                          <div className="w-20 text-right text-sm text-gray-500">${provider.estimatedCost?.toFixed(2)}</div>
                        </div>
                      ))}
                      {(!aiUsage.byProvider || aiUsage.byProvider.length === 0) && (
                        <div className="text-sm text-gray-500 text-center py-4">No provider data available</div>
                      )}
                    </div>
                  </div>

                  {/* Usage by Model */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Usage by Model</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2 font-medium">Model</th>
                            <th className="pb-2 font-medium text-right">Requests</th>
                            <th className="pb-2 font-medium text-right">Input Tokens</th>
                            <th className="pb-2 font-medium text-right">Output Tokens</th>
                            <th className="pb-2 font-medium text-right">Total Tokens</th>
                            <th className="pb-2 font-medium text-right">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {aiUsage.byModel?.map((model: any) => (
                            <tr key={model.model} className="text-gray-700 dark:text-gray-300">
                              <td className="py-2 font-mono text-xs">{model.model}</td>
                              <td className="py-2 text-right">{model.requests?.toLocaleString()}</td>
                              <td className="py-2 text-right">{model.promptTokens?.toLocaleString()}</td>
                              <td className="py-2 text-right">{model.completionTokens?.toLocaleString()}</td>
                              <td className="py-2 text-right font-medium">{model.totalTokens?.toLocaleString()}</td>
                              <td className="py-2 text-right">${model.estimatedCost?.toFixed(2)}</td>
                            </tr>
                          ))}
                          {(!aiUsage.byModel || aiUsage.byModel.length === 0) && (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-gray-500">No model data available</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Daily Usage Chart (simplified) */}
                  {aiUsage.chartData && aiUsage.chartData.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Daily Token Usage</h3>
                      <div className="flex items-end gap-1 h-32">
                        {aiUsage.chartData.slice(-30).map((day: any, idx: number) => {
                          const maxTokens = Math.max(...aiUsage.chartData.map((d: any) => d.totalTokens || 0));
                          const height = maxTokens > 0 ? ((day.totalTokens || 0) / maxTokens) * 100 : 0;
                          return (
                            <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                              <div
                                className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                style={{ height: `${Math.max(height, 2)}%` }}
                              />
                              <div className="absolute bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                {day.date}: {day.totalTokens?.toLocaleString()} tokens
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>{aiUsage.chartData[0]?.date}</span>
                        <span>{aiUsage.chartData[aiUsage.chartData.length - 1]?.date}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
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
                    <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900">
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

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingUser ? "Edit Team Member" : "Add Team Member"}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {userError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {userError}
                </div>
              )}

              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                      <Input
                        value={userFormData.firstName}
                        onChange={(e) => setUserFormData({ ...userFormData, firstName: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                      <Input
                        value={userFormData.lastName}
                        onChange={(e) => setUserFormData({ ...userFormData, lastName: e.target.value })}
                        placeholder="Smith"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
                      <Input
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                        placeholder="john@tcdsagency.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                      <Input
                        value={userFormData.phone}
                        onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                      <select
                        value={userFormData.role}
                        onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white text-gray-900"
                      >
                        <option value="agent">Agent</option>
                        <option value="csr">CSR</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Profile Photo URL</label>
                      <Input
                        type="url"
                        value={userFormData.avatarUrl}
                        onChange={(e) => setUserFormData({ ...userFormData, avatarUrl: e.target.value })}
                        placeholder="https://example.com/photo.jpg"
                      />
                      <p className="text-xs text-gray-500 mt-1">URL to user&apos;s profile photo image</p>
                    </div>
                  </div>
                </div>

                {/* Phone Numbers */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Phone Numbers</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Direct Dial</label>
                      <Input
                        value={userFormData.directDial}
                        onChange={(e) => setUserFormData({ ...userFormData, directDial: e.target.value })}
                        placeholder="(555) 123-4568"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cell Phone</label>
                      <Input
                        value={userFormData.cellPhone}
                        onChange={(e) => setUserFormData({ ...userFormData, cellPhone: e.target.value })}
                        placeholder="(555) 123-4569"
                      />
                    </div>
                  </div>
                </div>

                {/* Cross-System IDs */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cross-System IDs</h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 text-sm text-blue-700 dark:text-blue-300">
                    These IDs link this user to external systems for call routing, task assignment, and policy mapping.
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-mono text-xs bg-blue-100 dark:bg-blue-800 px-1 rounded mr-1">Ext</span>
                        3CX Extension
                      </label>
                      <Input
                        value={userFormData.extension}
                        onChange={(e) => setUserFormData({ ...userFormData, extension: e.target.value })}
                        placeholder="1001"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-mono text-xs bg-purple-100 dark:bg-purple-800 px-1 rounded mr-1">AZ</span>
                        AgencyZoom CSR ID
                      </label>
                      <Input
                        value={userFormData.agencyzoomId}
                        onChange={(e) => setUserFormData({ ...userFormData, agencyzoomId: e.target.value })}
                        placeholder="94007"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-mono text-xs bg-amber-100 dark:bg-amber-800 px-1 rounded mr-1">HS</span>
                        HawkSoft Code
                      </label>
                      <Input
                        value={userFormData.agentCode}
                        onChange={(e) => setUserFormData({ ...userFormData, agentCode: e.target.value })}
                        placeholder="LT"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Options</h4>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.inLeadRotation}
                      onChange={(e) => setUserFormData({ ...userFormData, inLeadRotation: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Include in Lead Rotation</div>
                      <div className="text-sm text-gray-500">This user will receive leads in the round-robin queue</div>
                    </div>
                  </label>
                </div>

                {/* Feature Permissions */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Feature Access
                  </h4>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 mb-4 text-sm text-emerald-700 dark:text-emerald-300">
                    Control which features this user can access. Admins have access to all features regardless of these settings.
                  </div>
                  {Object.entries(getFeaturesByCategory()).map(([category, features]) => (
                    <div key={category} className="mb-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        {category === 'core' ? 'Core Features' :
                         category === 'advanced' ? 'Advanced Features' :
                         'Admin Features'}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {features.map((feature) => (
                          <label
                            key={feature.key}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            title={feature.description}
                          >
                            <input
                              type="checkbox"
                              checked={userFormData.featurePermissions[feature.key] ?? feature.defaultEnabled}
                              onChange={(e) =>
                                setUserFormData({
                                  ...userFormData,
                                  featurePermissions: {
                                    ...userFormData.featurePermissions,
                                    [feature.key]: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {feature.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Password Reset (only when editing) */}
                {editingUser && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Reset Password
                    </h4>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4 text-sm text-amber-700 dark:text-amber-300">
                      Set a new password for this user. They will need to use this password on their next login.
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 8 characters)"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={passwordResetting || newPassword.length < 8}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        {passwordResetting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resetting...
                          </>
                        ) : passwordResetSuccess ? (
                          <>
                            <Check className="w-4 h-4 mr-2 text-green-500" />
                            Password Reset!
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            Reset Password
                          </>
                        )}
                      </Button>
                    </div>
                    {newPassword.length > 0 && newPassword.length < 8 && (
                      <p className="text-xs text-amber-600 mt-2">Password must be at least 8 characters</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={userSaving || !userFormData.firstName || !userFormData.lastName || !userFormData.email}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {userSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingUser ? "Update" : "Add"} Team Member
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTemplate ? "Edit Template" : "New SMS Template"}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g., Payment Reminder" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white text-gray-900"
                >
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="quotes">Quotes</option>
                  <option value="claims">Claims</option>
                  <option value="service">Service</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Content</label>
                <textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white text-gray-900"
                  placeholder="Hi {{customerName}}, this is {{agentName}} from TCDS Insurance..."
                />
                <p className="text-xs text-gray-500 mt-1">Use {"{{variableName}}"} for dynamic values like {"{{customerName}}"}, {"{{agentName}}"}, {"{{policyNumber}}"}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={templateSaving || !templateForm.name || !templateForm.content} className="bg-emerald-600 hover:bg-emerald-700">
                {templateSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingTemplate ? "Update" : "Create"} Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingWebhook ? "Edit Webhook" : "New Webhook"}
              </h3>
              <button onClick={() => setShowWebhookModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook Name</label>
                <Input value={webhookForm.name} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })} placeholder="e.g., Zapier Integration" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint URL</label>
                <Input value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://hooks.zapier.com/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Events to Trigger</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  {webhookEvents.map((event: any) => (
                    <label key={event.id} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookForm({ ...webhookForm, events: [...webhookForm.events, event.id] });
                          } else {
                            setWebhookForm({ ...webhookForm, events: webhookForm.events.filter((ev: string) => ev !== event.id) });
                          }
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{event.name}</div>
                        <div className="text-xs text-gray-500">{event.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowWebhookModal(false)}>Cancel</Button>
              <Button onClick={handleSaveWebhook} disabled={webhookSaving || !webhookForm.name || !webhookForm.url || webhookForm.events.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                {webhookSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingWebhook ? "Update" : "Create"} Webhook
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create API Key</h3>
              <button onClick={() => setShowApiKeyModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Name</label>
                <Input value={apiKeyForm.name} onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })} placeholder="e.g., Production API Key" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                <div className="space-y-2">
                  {["read", "write", "admin"].map((perm) => (
                    <label key={perm} className="flex items-center gap-3 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={apiKeyForm.permissions.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setApiKeyForm({ ...apiKeyForm, permissions: [...apiKeyForm.permissions, perm] });
                          } else {
                            setApiKeyForm({ ...apiKeyForm, permissions: apiKeyForm.permissions.filter((p: string) => p !== perm) });
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white capitalize">{perm}</div>
                        <div className="text-xs text-gray-500">
                          {perm === "read" && "Read access to data"}
                          {perm === "write" && "Create and update data"}
                          {perm === "admin" && "Full administrative access"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowApiKeyModal(false)}>Cancel</Button>
              <Button onClick={handleCreateApiKey} disabled={apiKeySaving || !apiKeyForm.name || apiKeyForm.permissions.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                {apiKeySaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
                Create API Key
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
