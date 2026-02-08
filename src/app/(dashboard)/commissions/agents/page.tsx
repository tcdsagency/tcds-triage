"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { CommissionTable } from "@/components/commissions/CommissionTable";
import { formatAgentRole, formatCurrency, formatSplitPercent } from "@/lib/commissions/formatters";
import type { CommissionAgent, CommissionAgentCode, CommissionAgentRole } from "@/types/commission.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentWithCodes extends CommissionAgent {
  codes?: CommissionAgentCode[];
}

interface AgentFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: CommissionAgentRole;
  isActive: boolean;
  hasDrawAccount: boolean;
  monthlyDrawAmount: string;
  defaultSplitPercent: string;
  notes: string;
}

const emptyForm: AgentFormData = {
  firstName: "",
  lastName: "",
  email: "",
  role: "producer",
  isActive: true,
  hasDrawAccount: false,
  monthlyDrawAmount: "",
  defaultSplitPercent: "100",
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
// Agent Code Management (inline in modal)
// ---------------------------------------------------------------------------

function AgentCodeSection({
  agentId,
  codes,
  onCodesChanged,
}: {
  agentId: string;
  codes: CommissionAgentCode[];
  onCodesChanged: () => void;
}) {
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const addCode = async () => {
    if (!newCode.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/commissions/agents/${agentId}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim(), description: newDescription.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent code added");
        setNewCode("");
        setNewDescription("");
        onCodesChanged();
      } else {
        toast.error(data.error || "Failed to add code");
      }
    } catch {
      toast.error("Failed to add code");
    } finally {
      setAdding(false);
    }
  };

  const deleteCode = async (codeId: string) => {
    try {
      const res = await fetch(`/api/commissions/agents/${agentId}/codes/${codeId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent code removed");
        onCodesChanged();
      } else {
        toast.error(data.error || "Failed to delete code");
      }
    } catch {
      toast.error("Failed to delete code");
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="font-medium mb-3">Agent Codes</h4>

      {codes.length > 0 && (
        <div className="space-y-2 mb-3">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2 text-sm">
              <div>
                <span className="font-mono font-medium">{c.code}</span>
                {c.description && <span className="text-gray-500 ml-2">- {c.description}</span>}
              </div>
              <button
                onClick={() => deleteCode(c.id)}
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
          <label className="block text-xs font-medium mb-1 text-gray-500">Code</label>
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="e.g. ABC123"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
            onKeyDown={(e) => e.key === "Enter" && addCode()}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1 text-gray-500">Description (optional)</label>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="e.g. Carrier XYZ"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
            onKeyDown={(e) => e.key === "Enter" && addCode()}
          />
        </div>
        <button
          onClick={addCode}
          disabled={adding || !newCode.trim()}
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

export default function CommissionAgentsPage() {
  const [agents, setAgents] = useState<AgentWithCodes[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentWithCodes | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Expanded agent codes (for inline code management outside modal)
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // ---- Debounced search ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---- Fetch agents ----
  const fetchAgents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/commissions/agents?${params}`);
      const data = await res.json();
      if (data.success) {
        // Fetch codes for each agent
        const agentsWithCodes: AgentWithCodes[] = await Promise.all(
          data.data.map(async (agent: CommissionAgent) => {
            try {
              const codeRes = await fetch(`/api/commissions/agents/${agent.id}/codes`);
              const codeData = await codeRes.json();
              return { ...agent, codes: codeData.success ? codeData.data : [] };
            } catch {
              return { ...agent, codes: [] };
            }
          })
        );
        setAgents(agentsWithCodes);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchAgents();
  }, [fetchAgents]);

  // ---- Open add/edit modal ----
  const openAddModal = () => {
    setEditingAgent(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = async (agent: AgentWithCodes) => {
    // Fetch the latest agent with codes
    try {
      const res = await fetch(`/api/commissions/agents/${agent.id}`);
      const data = await res.json();
      if (data.success) {
        const full = data.data as AgentWithCodes;
        setEditingAgent(full);
        setFormData({
          firstName: full.firstName,
          lastName: full.lastName,
          email: full.email || "",
          role: full.role,
          isActive: full.isActive,
          hasDrawAccount: full.hasDrawAccount,
          monthlyDrawAmount: full.monthlyDrawAmount || "",
          defaultSplitPercent: full.defaultSplitPercent || "100",
          notes: full.notes || "",
        });
        setIsModalOpen(true);
      } else {
        toast.error("Failed to load agent details");
      }
    } catch {
      toast.error("Failed to load agent details");
    }
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setSaving(true);
    try {
      const method = editingAgent ? "PATCH" : "POST";
      const url = editingAgent
        ? `/api/commissions/agents/${editingAgent.id}`
        : "/api/commissions/agents";

      const body = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim() || null,
        role: formData.role,
        isActive: formData.isActive,
        hasDrawAccount: formData.hasDrawAccount,
        monthlyDrawAmount: formData.hasDrawAccount ? formData.monthlyDrawAmount || null : null,
        defaultSplitPercent: formData.defaultSplitPercent || "100",
        notes: formData.notes.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingAgent ? "Agent updated" : "Agent created");
        setIsModalOpen(false);
        setEditingAgent(null);
        fetchAgents();
      } else {
        toast.error(data.error || "Failed to save agent");
      }
    } catch {
      toast.error("Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (agent: AgentWithCodes) => {
    if (!confirm(`Delete agent ${agent.firstName} ${agent.lastName}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/commissions/agents/${agent.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent deleted");
        fetchAgents();
      } else {
        toast.error(data.error || "Failed to delete agent");
      }
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  // ---- Table columns ----
  const columns = [
    {
      key: "lastName",
      label: "Name",
      sortable: true,
      render: (row: AgentWithCodes) => (
        <div className="font-medium">
          {row.firstName} {row.lastName}
          {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (row: AgentWithCodes) => (
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
          {formatAgentRole(row.role)}
        </span>
      ),
    },
    {
      key: "codes",
      label: "Codes",
      render: (row: AgentWithCodes) => {
        const codes = row.codes || [];
        if (codes.length === 0) return <span className="text-gray-400 text-xs">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {codes.map((c) => (
              <span key={c.id} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
                {c.code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "hasDrawAccount",
      label: "Draw Account",
      sortable: true,
      render: (row: AgentWithCodes) =>
        row.hasDrawAccount ? (
          <span className="text-xs text-green-700 dark:text-green-400">
            Yes ({formatCurrency(row.monthlyDrawAmount)}/mo)
          </span>
        ) : (
          <span className="text-xs text-gray-400">No</span>
        ),
    },
    {
      key: "defaultSplitPercent",
      label: "Split %",
      sortable: true,
      render: (row: AgentWithCodes) => (
        <span className="text-sm">{formatSplitPercent(row.defaultSplitPercent)}</span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      render: (row: AgentWithCodes) =>
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
      render: (row: AgentWithCodes) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row);
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700"
            title="Edit agent"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400 hover:text-red-600"
            title="Delete agent"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedAgentId(expandedAgentId === row.id ? null : row.id);
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700"
            title="Manage codes"
          >
            {expandedAgentId === row.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Agents</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage agents, codes, and draw accounts
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
      </div>

      {/* Agent Table */}
      <CommissionTable<AgentWithCodes>
        columns={columns}
        data={agents as (AgentWithCodes & Record<string, unknown>)[]}
        isLoading={loading}
        emptyMessage="No agents found. Add your first commission agent to get started."
      />

      {/* Expanded code management rows */}
      {agents.map((agent) =>
        expandedAgentId === agent.id ? (
          <div
            key={`codes-${agent.id}`}
            className="bg-gray-50 dark:bg-gray-800/50 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg px-6 py-4 -mt-px"
          >
            <AgentCodeSection
              agentId={agent.id}
              codes={agent.codes || []}
              onCodesChanged={fetchAgents}
            />
          </div>
        ) : null
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAgent(null);
        }}
        title={editingAgent ? "Edit Agent" : "Add Agent"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CommissionAgentRole })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="owner">Owner</option>
                <option value="producer">Producer</option>
                <option value="csr">CSR</option>
                <option value="house">House</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Split %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.defaultSplitPercent}
                onChange={(e) => setFormData({ ...formData, defaultSplitPercent: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.hasDrawAccount}
                onChange={(e) => setFormData({ ...formData, hasDrawAccount: e.target.checked })}
                className="rounded border-gray-300"
              />
              Has Draw Account
            </label>
          </div>

          {formData.hasDrawAccount && (
            <div>
              <label className="block text-sm font-medium mb-1">Monthly Draw Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthlyDrawAmount}
                onChange={(e) => setFormData({ ...formData, monthlyDrawAmount: e.target.value })}
                placeholder="e.g. 3000"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Code management in edit mode */}
          {editingAgent && (
            <AgentCodeSection
              agentId={editingAgent.id}
              codes={editingAgent.codes || []}
              onCodesChanged={async () => {
                // Refresh the editing agent's codes
                try {
                  const res = await fetch(`/api/commissions/agents/${editingAgent.id}`);
                  const data = await res.json();
                  if (data.success) {
                    setEditingAgent(data.data);
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
                setEditingAgent(null);
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
              {saving ? "Saving..." : editingAgent ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
