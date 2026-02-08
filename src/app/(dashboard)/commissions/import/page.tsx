"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, Clock } from "lucide-react";
import { ImportWizard } from "@/components/commissions/ImportWizard";

interface RecentImport {
  id: string;
  fileName: string;
  status: string;
  imported: number;
  skipped: number;
  errors: number;
  createdAt: string;
}

export default function CommissionImportPage() {
  const router = useRouter();
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);

  const fetchRecentImports = async () => {
    try {
      const res = await fetch("/api/commissions/dashboard");
      const data = await res.json();
      if (data.success && data.data?.recentImports) {
        setRecentImports(data.data.recentImports);
      }
    } catch (error) {
      console.error("Failed to fetch recent imports:", error);
    } finally {
      setLoadingImports(false);
    }
  };

  useEffect(() => {
    fetchRecentImports();
  }, []);

  const handleImportComplete = () => {
    toast.success("Commission import completed successfully");
    fetchRecentImports();
    router.push("/commissions/transactions");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Upload className="h-6 w-6 text-emerald-600" />
          Import Commissions
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload a carrier commission statement CSV, map columns to system fields, preview the data, and execute the import.
        </p>
      </div>

      {/* Import Wizard */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <ImportWizard onComplete={handleImportComplete} />
      </div>

      {/* Recent Imports */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-gray-400" />
          Recent Imports
        </h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {loadingImports ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading recent imports...</div>
          ) : recentImports.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              <FileText className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
              No imports yet. Upload a CSV above to get started.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imported
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skipped
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentImports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {imp.fileName}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(imp.status)}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {imp.imported}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {imp.skipped}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={imp.errors > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
                        {imp.errors}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
