"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { AgentSelector } from "./AgentSelector";
import { formatCurrency } from "@/lib/commissions/formatters";
import { toast } from "sonner";

interface Allocation {
  agentId: string;
  agentName?: string;
  splitPercent: number;
}

interface AllocationEditorProps {
  transactionId: string;
  commissionAmount: number;
  onSave?: () => void;
}

export function AllocationEditor({ transactionId, commissionAmount, onSave }: AllocationEditorProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/commissions/transactions/${transactionId}/allocations`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setAllocations(
            d.data.map((a: Record<string, unknown>) => ({
              agentId: a.agentId,
              agentName: a.agentName || `${(a.agent as Record<string,string>)?.firstName || ""} ${(a.agent as Record<string,string>)?.lastName || ""}`.trim(),
              splitPercent: parseFloat(String(a.splitPercent)),
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [transactionId]);

  const totalPercent = allocations.reduce((sum, a) => sum + a.splitPercent, 0);

  const addAllocation = () => {
    if (allocations.length >= 3) return;
    setAllocations([...allocations, { agentId: "", splitPercent: 0 }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, updates: Partial<Allocation>) => {
    setAllocations(
      allocations.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const handleSave = async () => {
    const valid = allocations.filter((a) => a.agentId && a.splitPercent > 0);
    if (valid.length === 0) {
      toast.error("At least one allocation is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/commissions/transactions/${transactionId}/allocations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: valid.map((a) => ({
            agentId: a.agentId,
            splitPercent: a.splitPercent,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Allocations saved");
      onSave?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading allocations...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent Allocations</h4>
        <span className="text-xs text-gray-500">
          Total: {formatCurrency(commissionAmount)}
        </span>
      </div>

      {allocations.map((alloc, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="flex-1">
            <AgentSelector
              value={alloc.agentId || null}
              onChange={(agentId, agentName) =>
                updateAllocation(idx, { agentId: agentId || "", agentName })
              }
              allowClear={false}
            />
          </div>
          <div className="w-24">
            <div className="flex items-center">
              <input
                type="number"
                value={alloc.splitPercent || ""}
                onChange={(e) => updateAllocation(idx, { splitPercent: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.5"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-l-md px-2 py-2 bg-white dark:bg-gray-800 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="px-2 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md text-gray-500">
                %
              </span>
            </div>
          </div>
          <div className="w-24 text-sm text-right text-gray-600 dark:text-gray-300">
            {formatCurrency(commissionAmount * (alloc.splitPercent / 100))}
          </div>
          <button
            onClick={() => removeAllocation(idx)}
            className="p-1.5 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {allocations.length < 3 && (
            <button
              onClick={addAllocation}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add Agent
            </button>
          )}
          {totalPercent !== 100 && allocations.length > 0 && (
            <span className="text-xs text-amber-600">
              Total: {totalPercent.toFixed(1)}% (should be 100%)
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || allocations.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
