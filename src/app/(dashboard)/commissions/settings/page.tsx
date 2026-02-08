"use client";

import { useState, useEffect } from "react";
import { Settings, Map, Trash2, Users, Building2, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";

interface FieldMapping {
  id: string;
  name: string;
  carrierName: string | null;
  fieldCount: number;
  isDefault: boolean;
}

export default function CommissionSettingsPage() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [carrierCount, setCarrierCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
    fetchCounts();
  }, []);

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/commissions/field-mappings");
      const data = await res.json();
      if (data.success) {
        setMappings(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch field mappings:", error);
    } finally {
      setLoadingMappings(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const [agentsRes, carriersRes] = await Promise.all([
        fetch("/api/commissions/agents"),
        fetch("/api/commissions/carriers"),
      ]);
      const agentsData = await agentsRes.json();
      const carriersData = await carriersRes.json();

      if (agentsData.success && Array.isArray(agentsData.data)) {
        setAgentCount(agentsData.data.length);
      }
      if (carriersData.success && Array.isArray(carriersData.data)) {
        setCarrierCount(carriersData.data.length);
      }
    } catch (error) {
      console.error("Failed to fetch counts:", error);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm("Are you sure you want to delete this field mapping?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/commissions/field-mappings/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMappings((prev) => prev.filter((m) => m.id !== id));
        toast.success("Field mapping deleted");
      } else {
        toast.error(data.error || "Failed to delete mapping");
      }
    } catch (error) {
      console.error("Failed to delete mapping:", error);
      toast.error("Failed to delete mapping");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" />
          Commission Settings
        </h1>
      </div>

      {/* Saved Field Mappings */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <Map className="h-5 w-5 text-gray-400" />
          Saved Field Mappings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Field mappings are created during the import process. Saved mappings can be reused for future imports from the same carrier.
        </p>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {loadingMappings ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              <Map className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
              No saved field mappings yet. Mappings are created during the import process.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    # Fields
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {mapping.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {mapping.carrierName || "Any"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {mapping.fieldCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mapping.isDefault ? (
                        <Star className="h-4 w-4 text-yellow-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        disabled={deleting === mapping.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                        title="Delete mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* System Info */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          System Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Agents Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Agents</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {agentCount !== null ? agentCount : "--"}
                  </p>
                </div>
              </div>
              <a
                href="/commissions/agents"
                className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                Manage
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Carriers Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Carriers</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {carrierCount !== null ? carrierCount : "--"}
                  </p>
                </div>
              </div>
              <a
                href="/commissions/carriers"
                className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                Manage
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
