"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  Landmark,
  Car,
  Home,
  Trash2,
  Pencil,
  X,
  Copy,
  Check,
  FileText,
  Clock,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// Types
interface LienHolder {
  id: string;
  name: string;
  type: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  fax: string | null;
  email: string | null;
  notes: string | null;
  isFavorite: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface MortgageeClause {
  id: string;
  displayName: string;
  clauseText: string;
  policyTypes: string[] | null;
  isActive: boolean;
  lienHolderId: string | null;
  lienHolder: { id: string; name: string } | null;
  uploadWebsite: string | null;
  phone: string | null;
  fax: string | null;
  notes: string | null;
  createdAt: string;
}

type TabType = "lienholders" | "clauses";

const LIEN_HOLDER_TYPES = [
  { value: "bank", label: "Bank", icon: Landmark },
  { value: "credit_union", label: "Credit Union", icon: Building },
  { value: "finance_company", label: "Finance Company", icon: Car },
  { value: "mortgage_company", label: "Mortgage Company", icon: Home },
  { value: "other", label: "Other", icon: Building },
];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// CSV Parser - handles quoted fields and commas within quotes
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx]?.trim() || "";
    });
    if (Object.values(record).some((v) => v)) {
      records.push(record);
    }
  }
  return records;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Lien Holder Form
function LienHolderForm({
  lienHolder,
  onSave,
  onCancel,
}: {
  lienHolder?: LienHolder;
  onSave: (data: Partial<LienHolder>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: lienHolder?.name || "",
    type: lienHolder?.type || "",
    address1: lienHolder?.address1 || "",
    address2: lienHolder?.address2 || "",
    city: lienHolder?.city || "",
    state: lienHolder?.state || "",
    zipCode: lienHolder?.zipCode || "",
    phone: lienHolder?.phone || "",
    fax: lienHolder?.fax || "",
    email: lienHolder?.email || "",
    notes: lienHolder?.notes || "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(formData);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">Select type...</option>
          {LIEN_HOLDER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Address Line 1 *</label>
        <input
          type="text"
          required
          value={formData.address1}
          onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Address Line 2</label>
        <input
          type="text"
          value={formData.address2}
          onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-1">City *</label>
          <input
            type="text"
            required
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">State *</label>
          <input
            type="text"
            required
            maxLength={2}
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
            placeholder="TX"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ZIP *</label>
          <input
            type="text"
            required
            value={formData.zipCode}
            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fax</label>
          <input
            type="text"
            value={formData.fax}
            onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {lienHolder ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// Mortgagee Clause Form
function ClauseForm({
  clause,
  lienHolders,
  onSave,
  onCancel,
}: {
  clause?: MortgageeClause;
  lienHolders: LienHolder[];
  onSave: (data: Partial<MortgageeClause>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    displayName: clause?.displayName || "",
    clauseText: clause?.clauseText || "",
    lienHolderId: clause?.lienHolderId || "",
    policyTypes: clause?.policyTypes || [],
    isActive: clause?.isActive !== false,
    uploadWebsite: clause?.uploadWebsite || "",
    phone: clause?.phone || "",
    fax: clause?.fax || "",
    notes: clause?.notes || "",
  });

  const togglePolicyType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      policyTypes: prev.policyTypes.includes(type)
        ? prev.policyTypes.filter((t) => t !== type)
        : [...prev.policyTypes, type],
    }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...formData,
          lienHolderId: formData.lienHolderId || null,
          policyTypes: formData.policyTypes.length > 0 ? formData.policyTypes : null,
          uploadWebsite: formData.uploadWebsite || null,
          phone: formData.phone || null,
          fax: formData.fax || null,
          notes: formData.notes || null,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Display Name *</label>
        <input
          type="text"
          required
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          placeholder="e.g., Chase Mortgage - Standard"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Link to Lien Holder</label>
        <select
          value={formData.lienHolderId}
          onChange={(e) => setFormData({ ...formData, lienHolderId: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">No linked lien holder</option>
          {lienHolders.map((lh) => (
            <option key={lh.id} value={lh.id}>
              {lh.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Clause Text *</label>
        <textarea
          required
          value={formData.clauseText}
          onChange={(e) => setFormData({ ...formData, clauseText: e.target.value })}
          rows={5}
          placeholder="Enter the full mortgagee clause text..."
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Policy Types</label>
        <div className="flex flex-wrap gap-2">
          {["Home", "Auto", "Flood", "Umbrella", "Dwelling Fire"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => togglePolicyType(type)}
              className={`px-3 py-1 rounded-full text-sm ${
                formData.policyTypes.includes(type)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Upload Website</label>
        <input
          type="url"
          value={formData.uploadWebsite}
          onChange={(e) => setFormData({ ...formData, uploadWebsite: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
        <p className="text-xs text-gray-500 mt-1">Website URL to upload evidence of insurance</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fax</label>
          <input
            type="text"
            value={formData.fax}
            onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Additional notes about this mortgagee clause..."
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="rounded border-gray-300"
        />
        <label htmlFor="isActive" className="text-sm">
          Active (available for use)
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {clause ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// Type badge component
function TypeBadge({ type }: { type: string | null }) {
  const typeConfig = LIEN_HOLDER_TYPES.find((t) => t.value === type);
  if (!typeConfig) return null;

  const Icon = typeConfig.icon;
  const colors: Record<string, string> = {
    bank: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    credit_union: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    finance_company: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    mortgage_company: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[type || "other"]}`}>
      <Icon className="w-3 h-3" />
      {typeConfig.label}
    </span>
  );
}

// Main Page Component
export default function LienHoldersPage() {
  const [activeTab, setActiveTab] = useState<TabType>("lienholders");
  const [lienHolders, setLienHolders] = useState<LienHolder[]>([]);
  const [clauses, setClauses] = useState<MortgageeClause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLienHolder, setEditingLienHolder] = useState<LienHolder | null>(null);
  const [editingClause, setEditingClause] = useState<MortgageeClause | null>(null);

  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Fetch lien holders
  const fetchLienHolders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (showFavorites) params.set("favorites", "true");
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/lien-holders?${params}`);
      const data = await res.json();
      if (data.success) {
        setLienHolders(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch lien holders:", error);
    }
  }, [search, showFavorites, typeFilter]);

  // Fetch clauses
  const fetchClauses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/mortgagee-clauses?${params}`);
      const data = await res.json();
      if (data.success) {
        setClauses(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch clauses:", error);
    }
  }, [search]);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLienHolders(), fetchClauses()]).finally(() => setLoading(false));
  }, [fetchLienHolders, fetchClauses]);

  // Toggle favorite
  const toggleFavorite = async (id: string) => {
    try {
      await fetch(`/api/lien-holders/${id}/favorite`, { method: "POST" });
      fetchLienHolders();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  // Mark as used
  const markAsUsed = async (id: string) => {
    try {
      await fetch(`/api/lien-holders/${id}/used`, { method: "POST" });
    } catch (error) {
      console.error("Failed to mark as used:", error);
    }
  };

  // Copy address
  const copyAddress = async (lh: LienHolder) => {
    const address = [lh.name, lh.address1, lh.address2, `${lh.city}, ${lh.state} ${lh.zipCode}`]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(address);
    setCopiedId(lh.id);
    markAsUsed(lh.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy clause
  const copyClause = async (clause: MortgageeClause) => {
    await navigator.clipboard.writeText(clause.clauseText);
    setCopiedId(clause.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save lien holder
  const saveLienHolder = async (data: Partial<LienHolder>) => {
    try {
      const method = editingLienHolder ? "PATCH" : "POST";
      const url = editingLienHolder ? `/api/lien-holders/${editingLienHolder.id}` : "/api/lien-holders";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingLienHolder(null);
        fetchLienHolders();
      }
    } catch (error) {
      console.error("Failed to save lien holder:", error);
    }
  };

  // Save clause
  const saveClause = async (data: Partial<MortgageeClause>) => {
    try {
      const method = editingClause ? "PATCH" : "POST";
      const url = editingClause ? `/api/mortgagee-clauses/${editingClause.id}` : "/api/mortgagee-clauses";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingClause(null);
        fetchClauses();
      }
    } catch (error) {
      console.error("Failed to save clause:", error);
    }
  };

  // Delete lien holder
  const deleteLienHolder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lien holder?")) return;
    try {
      await fetch(`/api/lien-holders/${id}`, { method: "DELETE" });
      fetchLienHolders();
    } catch (error) {
      console.error("Failed to delete lien holder:", error);
    }
  };

  // Delete clause
  const deleteClause = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mortgagee clause?")) return;
    try {
      await fetch(`/api/mortgagee-clauses/${id}`, { method: "DELETE" });
      fetchClauses();
    } catch (error) {
      console.error("Failed to delete clause:", error);
    }
  };

  // Handle CSV import
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const records = parseCSV(text);

      if (records.length === 0) {
        setImportResult({ imported: 0, skipped: 0, errors: ["No valid records found in CSV"] });
        setImporting(false);
        return;
      }

      const endpoint = activeTab === "lienholders" ? "/api/lien-holders/import" : "/api/mortgagee-clauses/import";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      const data = await res.json();
      setImportResult({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
      });

      // Refresh data
      if (activeTab === "lienholders") {
        fetchLienHolders();
      } else {
        fetchClauses();
      }
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({ imported: 0, skipped: 0, errors: ["Failed to process file"] });
    } finally {
      setImporting(false);
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    let csv: string;
    let filename: string;

    if (activeTab === "lienholders") {
      csv = "name,type,address1,address2,city,state,zipCode,phone,fax,email,notes\n";
      csv += "Chase Bank,bank,\"123 Main St\",\"Suite 100\",Dallas,TX,75201,800-555-1234,800-555-1235,info@chase.com,Main branch\n";
      filename = "lien_holders_template.csv";
    } else {
      csv = "displayName,clauseText,policyTypes,uploadWebsite,phone,fax,notes\n";
      csv += "\"Chase Mortgage - Standard\",\"Chase Home Finance LLC, Its Successors and/or Assigns, ISAOA ATIMA, 123 Main St, Dallas TX 75201\",\"Home, Flood\",https://chase.com/insurance-upload,800-555-1234,800-555-1235,\"Upload via portal or fax\"\n";
      filename = "mortgagee_clauses_template.csv";
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lien Holders</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage mortgage companies, banks, and auto finance lienholders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingLienHolder(null);
              setEditingClause(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === "lienholders" ? "Lien Holder" : "Clause"}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        {activeTab === "lienholders" && (
          <>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                showFavorites
                  ? "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Star className={`w-4 h-4 ${showFavorites ? "fill-current" : ""}`} />
              Favorites
            </button>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">All Types</option>
              {LIEN_HOLDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("lienholders")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            activeTab === "lienholders"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Lien Holders ({lienHolders.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("clauses")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            activeTab === "clauses"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Mortgagee Clauses ({clauses.length})
          </div>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : activeTab === "lienholders" ? (
        <div className="space-y-4">
          {lienHolders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No lien holders found. Add your first lien holder to get started.
            </div>
          ) : (
            lienHolders.map((lh) => (
              <div
                key={lh.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{lh.name}</h3>
                      <TypeBadge type={lh.type} />
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <div>{lh.address1}</div>
                      {lh.address2 && <div>{lh.address2}</div>}
                      <div>
                        {lh.city}, {lh.state} {lh.zipCode}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {lh.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {lh.phone}
                        </span>
                      )}
                      {lh.email && (
                        <a
                          href={`mailto:${lh.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {lh.email}
                        </a>
                      )}
                      {lh.lastUsedAt && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-4 h-4" />
                          Last used {formatDate(lh.lastUsedAt)}
                        </span>
                      )}
                    </div>
                    {lh.notes && <div className="mt-3 text-sm text-gray-500 italic">{lh.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyAddress(lh)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                      title="Copy address"
                    >
                      {copiedId === lh.id ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleFavorite(lh.id)}
                      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        lh.isFavorite ? "text-yellow-500" : "text-gray-400"
                      }`}
                    >
                      <Star className={`w-5 h-5 ${lh.isFavorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingLienHolder(lh);
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteLienHolder(lh.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {clauses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No mortgagee clauses found. Add your first clause to get started.
            </div>
          ) : (
            clauses.map((clause) => (
              <div
                key={clause.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                  clause.isActive
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-gray-200 dark:border-gray-700 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{clause.displayName}</h3>
                      {!clause.isActive && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {clause.lienHolder && (
                      <div className="text-sm text-gray-500 mt-1">Linked to: {clause.lienHolder.name}</div>
                    )}
                    {clause.policyTypes && clause.policyTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {clause.policyTypes.map((type, i) => (
                          <span
                            key={i}
                            className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono whitespace-pre-wrap">
                      {clause.clauseText.length > 200
                        ? `${clause.clauseText.substring(0, 200)}...`
                        : clause.clauseText}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => copyClause(clause)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                      title="Copy clause"
                    >
                      {copiedId === clause.id ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingClause(clause);
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteClause(clause.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLienHolder(null);
          setEditingClause(null);
        }}
        title={
          activeTab === "lienholders"
            ? editingLienHolder
              ? "Edit Lien Holder"
              : "Add Lien Holder"
            : editingClause
            ? "Edit Mortgagee Clause"
            : "Add Mortgagee Clause"
        }
      >
        {activeTab === "lienholders" ? (
          <LienHolderForm
            lienHolder={editingLienHolder || undefined}
            onSave={saveLienHolder}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingLienHolder(null);
            }}
          />
        ) : (
          <ClauseForm
            clause={editingClause || undefined}
            lienHolders={lienHolders}
            onSave={saveClause}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingClause(null);
            }}
          />
        )}
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import ${activeTab === "lienholders" ? "Lien Holders" : "Mortgagee Clauses"} from CSV`}
      >
        <div className="space-y-4">
          {!importResult ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload a CSV file to import {activeTab === "lienholders" ? "lien holders" : "mortgagee clauses"} in bulk.
              </p>

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                  className="hidden"
                  id="csv-upload-lien"
                  disabled={importing}
                />
                <label
                  htmlFor="csv-upload-lien"
                  className="flex flex-col items-center cursor-pointer"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
                      <span className="text-sm text-gray-500">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm font-medium">Click to upload CSV</span>
                      <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                    </>
                  )}
                </label>
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Download className="w-4 h-4" />
                Download CSV template
              </button>

              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Required columns:</p>
                {activeTab === "lienholders" ? (
                  <p>name, address1, city, state, zipCode</p>
                ) : (
                  <p>displayName, clauseText</p>
                )}
                <p className="font-medium mt-2">Optional columns:</p>
                {activeTab === "lienholders" ? (
                  <p>type (bank, credit_union, finance_company, mortgage_company, other), address2, phone, fax, email, notes</p>
                ) : (
                  <p>policyTypes (comma-separated: Home, Auto, Flood)</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {importResult.imported > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span>{importResult.imported} records imported successfully</span>
                  </div>
                )}
                {importResult.skipped > 0 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    <span>{importResult.skipped} records skipped</span>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                    <div className="max-h-40 overflow-y-auto text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2 space-y-1">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                      {importResult.errors.length > 10 && (
                        <p className="font-medium">...and {importResult.errors.length - 10} more errors</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setImportResult(null)}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Import More
                </button>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
