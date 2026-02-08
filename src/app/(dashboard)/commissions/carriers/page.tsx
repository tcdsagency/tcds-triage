"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CommissionTable } from "@/components/commissions/CommissionTable";
import { formatPercent } from "@/lib/commissions/formatters";
import type { CommissionCarrier, CommissionCarrierAlias } from "@/types/commission.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarrierWithAliases extends CommissionCarrier {
  aliases?: CommissionCarrierAlias[];
}

interface CarrierFormData {
  name: string;
  carrierCode: string;
  defaultNewBusinessRate: string;
  defaultRenewalRate: string;
  isActive: boolean;
  notes: string;
}

const emptyForm: CarrierFormData = {
  name: "",
  carrierCode: "",
  defaultNewBusinessRate: "",
  defaultRenewalRate: "",
  isActive: true,
  notes: "",
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Alias Management (inline in modal)
// ---------------------------------------------------------------------------

function AliasSection({
  carrierId,
  aliases,
  onAliasesChanged,
}: {
  carrierId: string;
  aliases: CommissionCarrierAlias[];
  onAliasesChanged: () => void;
}) {
  const [newAlias, setNewAlias] = useState("");
  const [adding, setAdding] = useState(false);

  const addAlias = async () => {
    if (!newAlias.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/commissions/carriers/${carrierId}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: newAlias.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Alias added");
        setNewAlias("");
        onAliasesChanged();
      } else {
        toast.error(data.error || "Failed to add alias");
      }
    } catch {
      toast.error("Failed to add alias");
    } finally {
      setAdding(false);
    }
  };

  const deleteAlias = async (aliasId: string) => {
    try {
      const res = await fetch(`/api/commissions/carriers/${carrierId}/aliases/${aliasId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Alias removed");
        onAliasesChanged();
      } else {
        toast.error(data.error || "Failed to delete alias");
      }
    } catch {
      toast.error("Failed to delete alias");
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="font-medium mb-3">Carrier Aliases</h4>
      <p className="text-xs text-gray-500 mb-3">
        Aliases help match this carrier when names vary across commission statements.
      </p>

      {aliases.length > 0 && (
        <div className="space-y-2 mb-3">
          {aliases.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2 text-sm">
              <span>{a.alias}</span>
              <button
                onClick={() => deleteAlias(a.id)}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1 text-gray-500">New Alias</label>
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="e.g. Carrier Alt Name"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAlias())}
          />
        </div>
        <button
          onClick={addAlias}
          disabled={adding || !newAlias.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
        >
          {adding ? "..." : "Add"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CommissionCarriersPage() {
  const [carriers, setCarriers] = useState<CarrierWithAliases[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<CarrierWithAliases | null>(null);
  const [formData, setFormData] = useState<CarrierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // ---- Debounced search ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---- Fetch carriers ----
  const fetchCarriers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/commissions/carriers?${params}`);
      const data = await res.json();
      if (data.success) {
        // Fetch aliases for each carrier
        const carriersWithAliases: CarrierWithAliases[] = await Promise.all(
          data.data.map(async (carrier: CommissionCarrier) => {
            try {
              const aliasRes = await fetch(`/api/commissions/carriers/${carrier.id}/aliases`);
              const aliasData = await aliasRes.json();
              return { ...carrier, aliases: aliasData.success ? aliasData.data : [] };
            } catch {
              return { ...carrier, aliases: [] };
            }
          })
        );
        setCarriers(carriersWithAliases);
      }
    } catch (error) {
      console.error("Failed to fetch carriers:", error);
      toast.error("Failed to load carriers");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchCarriers();
  }, [fetchCarriers]);

  // ---- Open add/edit modal ----
  const openAddModal = () => {
    setEditingCarrier(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = async (carrier: CarrierWithAliases) => {
    try {
      const res = await fetch(`/api/commissions/carriers/${carrier.id}`);
      const data = await res.json();
      if (data.success) {
        const full = data.data as CarrierWithAliases;
        setEditingCarrier(full);
        setFormData({
          name: full.name,
          carrierCode: full.carrierCode || "",
          defaultNewBusinessRate: full.defaultNewBusinessRate || "",
          defaultRenewalRate: full.defaultRenewalRate || "",
          isActive: full.isActive,
          notes: full.notes || "",
        });
        setIsModalOpen(true);
      } else {
        toast.error("Failed to load carrier details");
      }
    } catch {
      toast.error("Failed to load carrier details");
    }
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Carrier name is required");
      return;
    }

    setSaving(true);
    try {
      const method = editingCarrier ? "PATCH" : "POST";
      const url = editingCarrier
        ? `/api/commissions/carriers/${editingCarrier.id}`
        : "/api/commissions/carriers";

      const body = {
        name: formData.name.trim(),
        carrierCode: formData.carrierCode.trim() || null,
        defaultNewBusinessRate: formData.defaultNewBusinessRate || null,
        defaultRenewalRate: formData.defaultRenewalRate || null,
        isActive: formData.isActive,
        notes: formData.notes.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingCarrier ? "Carrier updated" : "Carrier created");
        setIsModalOpen(false);
        setEditingCarrier(null);
        fetchCarriers();
      } else {
        toast.error(data.error || "Failed to save carrier");
      }
    } catch {
      toast.error("Failed to save carrier");
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (carrier: CarrierWithAliases) => {
    if (!confirm(`Delete carrier "${carrier.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/commissions/carriers/${carrier.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Carrier deleted");
        fetchCarriers();
      } else {
        toast.error(data.error || "Failed to delete carrier");
      }
    } catch {
      toast.error("Failed to delete carrier");
    }
  };

  // ---- Table columns ----
  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row: CarrierWithAliases) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: "carrierCode",
      label: "Code",
      sortable: true,
      render: (row: CarrierWithAliases) =>
        row.carrierCode ? (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
            {row.carrierCode}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">--</span>
        ),
    },
    {
      key: "defaultNewBusinessRate",
      label: "NB Rate",
      sortable: true,
      render: (row: CarrierWithAliases) =>
        row.defaultNewBusinessRate ? (
          <span className="text-sm">{formatPercent(row.defaultNewBusinessRate)}</span>
        ) : (
          <span className="text-gray-400 text-xs">--</span>
        ),
    },
    {
      key: "defaultRenewalRate",
      label: "Renewal Rate",
      sortable: true,
      render: (row: CarrierWithAliases) =>
        row.defaultRenewalRate ? (
          <span className="text-sm">{formatPercent(row.defaultRenewalRate)}</span>
        ) : (
          <span className="text-gray-400 text-xs">--</span>
        ),
    },
    {
      key: "aliases",
      label: "Aliases",
      render: (row: CarrierWithAliases) => {
        const aliases = row.aliases || [];
        if (aliases.length === 0) return <span className="text-gray-400 text-xs">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {aliases.map((a) => (
              <span key={a.id} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {a.alias}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      render: (row: CarrierWithAliases) =>
        row.isActive ? (
          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
            Active
          </span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded">
            Inactive
          </span>
        ),
    },
    {
      key: "_actions",
      label: "Actions",
      render: (row: CarrierWithAliases) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row);
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700"
            title="Edit carrier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400 hover:text-red-600"
            title="Delete carrier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Carriers</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage carriers, commission rates, and name aliases
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Carrier
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search carriers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
      </div>

      {/* Carrier Table */}
      <CommissionTable<CarrierWithAliases>
        columns={columns}
        data={carriers as (CarrierWithAliases & Record<string, unknown>)[]}
        isLoading={loading}
        emptyMessage="No carriers found. Add your first commission carrier to get started."
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCarrier(null);
        }}
        title={editingCarrier ? "Edit Carrier" : "Add Carrier"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Carrier Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Carrier Code</label>
            <input
              type="text"
              value={formData.carrierCode}
              onChange={(e) => setFormData({ ...formData, carrierCode: e.target.value })}
              placeholder="e.g. SAFECO, PROG"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">New Business Rate</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.defaultNewBusinessRate}
                  onChange={(e) => setFormData({ ...formData, defaultNewBusinessRate: e.target.value })}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Renewal Rate</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.defaultRenewalRate}
                  onChange={(e) => setFormData({ ...formData, defaultRenewalRate: e.target.value })}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              Active
            </label>
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

          {/* Alias management in edit mode */}
          {editingCarrier && (
            <AliasSection
              carrierId={editingCarrier.id}
              aliases={editingCarrier.aliases || []}
              onAliasesChanged={async () => {
                // Refresh the editing carrier's aliases
                try {
                  const res = await fetch(`/api/commissions/carriers/${editingCarrier.id}`);
                  const data = await res.json();
                  if (data.success) {
                    setEditingCarrier(data.data);
                  }
                } catch {
                  // silent
                }
              }}
            />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCarrier(null);
              }}
              className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingCarrier ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
