"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ban,
  Filter,
  RefreshCw,
  Upload,
  Link2,
  Settings,
  Loader2,
  Phone,
  User,
  Calendar,
  MessageSquare,
  X,
  Search,
  ExternalLink,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface ReviewRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  sentiment: string | null;
  scheduledFor: string;
  status: string;
  sentAt: string | null;
  suppressed: boolean;
  suppressionReason: string | null;
  createdAt: string;
}

interface GoogleReview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewTimestamp: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchConfidence: string | null;
}

interface RequestStats {
  total: number;
  pending_approval: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
  opted_out: number;
  suppressed: number;
  today: {
    sent: number;
    scheduled: number;
  };
}

interface ReviewStats {
  total: number;
  matched: number;
  unmatched: number;
  avgRating: number;
  ratingBreakdown: Record<number, number>;
  last30Days: {
    count: number;
    avgRating: number;
  };
}

// =============================================================================
// STATUS CONFIG
// =============================================================================

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending_approval: { label: "Needs Approval", icon: ShieldCheck, color: "bg-blue-100 text-blue-700" },
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  sent: { label: "Sent", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  failed: { label: "Failed", icon: XCircle, color: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", icon: Ban, color: "bg-gray-100 text-gray-700" },
  opted_out: { label: "Opted Out", icon: AlertCircle, color: "bg-orange-100 text-orange-700" },
  suppressed: { label: "Suppressed", icon: Ban, color: "bg-purple-100 text-purple-700" },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReviewManagerPage() {
  // State
  const [activeTab, setActiveTab] = useState<"requests" | "reviews" | "settings">("requests");
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [processing, setProcessing] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // Settings state
  const [googleReviewLink, setGoogleReviewLink] = useState("");
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/review-requests/settings");
      const data = await res.json();
      if (data.success) {
        setAutoSendEnabled(data.settings.autoSendEnabled);
        setGoogleReviewLink(data.settings.googleReviewLink || "");
        setSettingsLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }, []);

  // Save settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/review-requests/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoSendEnabled,
          googleReviewLink,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Settings saved
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  // Approve request
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/review-requests/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error approving:", error);
    }
  };

  // Reject request
  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/review-requests/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    }
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, reqStatsRes, revRes, revStatsRes] = await Promise.all([
        fetch(`/api/review-requests?status=${statusFilter}`),
        fetch("/api/review-requests/stats"),
        fetch("/api/google-reviews"),
        fetch("/api/google-reviews/stats"),
      ]);

      const [reqData, reqStatsData, revData, revStatsData] = await Promise.all([
        reqRes.json(),
        reqStatsRes.json(),
        revRes.json(),
        revStatsRes.json(),
      ]);

      if (reqData.success) setRequests(reqData.requests);
      if (reqStatsData.success) setRequestStats(reqStatsData.stats);
      if (revData.success) setReviews(revData.reviews);
      if (revStatsData.success) setReviewStats(revStatsData.stats);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Process pending requests
  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/review-requests/process", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error processing:", error);
    } finally {
      setProcessing(false);
    }
  };

  // Cancel request
  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/review-requests/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error cancelling:", error);
    }
  };

  // Import reviews
  const handleImport = async () => {
    if (!importText.trim()) return;

    setImporting(true);
    try {
      // Parse input - try JSON first, then CSV-like format
      let reviewsToImport: any[] = [];

      try {
        reviewsToImport = JSON.parse(importText);
      } catch {
        // Parse as simple format: "Name | Rating | Comment" per line
        const lines = importText.split("\n").filter((l) => l.trim());
        reviewsToImport = lines.map((line) => {
          const parts = line.split("|").map((p) => p.trim());
          return {
            reviewerName: parts[0] || "Unknown",
            rating: parseInt(parts[1]) || 5,
            comment: parts[2] || "",
            reviewTimestamp: new Date().toISOString(),
          };
        });
      }

      const res = await fetch("/api/google-reviews/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: reviewsToImport }),
      });

      const data = await res.json();
      if (data.success) {
        setShowImportModal(false);
        setImportText("");
        fetchData();
      }
    } catch (error) {
      console.error("Error importing:", error);
    } finally {
      setImporting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Render stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-4 h-4",
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-7 h-7 text-yellow-500" />
          Review Manager
        </h1>
        <p className="text-gray-500">
          Request and track Google reviews from satisfied customers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {requestStats && (
          <>
            <StatCard
              label="Total Requests"
              value={requestStats.total}
              icon={Send}
              color="bg-blue-50 text-blue-600"
            />
            {requestStats.pending_approval > 0 && (
              <StatCard
                label="Needs Approval"
                value={requestStats.pending_approval}
                icon={ShieldCheck}
                color="bg-blue-50 text-blue-600"
              />
            )}
            <StatCard
              label="Pending"
              value={requestStats.pending}
              icon={Clock}
              color="bg-yellow-50 text-yellow-600"
            />
            <StatCard
              label="Sent"
              value={requestStats.sent}
              icon={CheckCircle}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label="Failed"
              value={requestStats.failed}
              icon={XCircle}
              color="bg-red-50 text-red-600"
            />
          </>
        )}
        {reviewStats && (
          <>
            <StatCard
              label="Total Reviews"
              value={reviewStats.total}
              icon={Star}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              label="Avg Rating"
              value={reviewStats.avgRating.toFixed(1)}
              icon={Star}
              color="bg-yellow-50 text-yellow-600"
              suffix="★"
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { id: "requests", label: "Review Requests", icon: Send },
            { id: "reviews", label: "Google Reviews", icon: Star },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {activeTab === "requests" && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending_approval">Needs Approval</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="suppressed">Suppressed</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleProcess}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Process Now
              </Button>
            </>
          )}
          {activeTab === "reviews" && (
            <Button
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Reviews
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : activeTab === "requests" ? (
          <div className="divide-y">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No review requests yet</p>
              </div>
            ) : (
              requests.map((req) => {
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={req.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {req.customerName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {req.customerPhone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(req.scheduledFor)}
                        </div>
                        {req.sentAt && (
                          <div className="text-xs text-green-600">
                            Sent: {formatDate(req.sentAt)}
                          </div>
                        )}
                      </div>

                      <Badge className={statusConfig.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>

                      {req.status === "pending_approval" && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(req.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <ThumbsDown className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {req.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(req.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "reviews" ? (
          <div className="divide-y">
            {reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No reviews imported yet</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowImportModal(true)}
                >
                  Import Reviews
                </Button>
              </div>
            ) : (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 flex items-start justify-between hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900">
                        {review.reviewerName}
                      </span>
                      {renderStars(review.rating)}
                      <span className="text-sm text-gray-500">
                        {formatDate(review.reviewTimestamp)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 mt-1">
                        "{review.comment}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {review.matchedCustomerId ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Matched: {review.matchedCustomerName}
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unmatched
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Settings Tab
          <div className="p-6 max-w-2xl">
            <h3 className="text-lg font-semibold mb-6">Review Request Settings</h3>

            <div className="space-y-6">
              {/* Google Review Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Review Link
                </label>
                <div className="flex gap-2">
                  <Input
                    value={googleReviewLink}
                    onChange={(e) => setGoogleReviewLink(e.target.value)}
                    placeholder="https://g.page/r/YOUR_REVIEW_LINK"
                    className="flex-1"
                  />
                  <Button variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  This link will be included in review request SMS messages
                </p>
              </div>

              {/* Auto-Send Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    Auto-Send Review Requests
                  </div>
                  <div className="text-sm text-gray-500">
                    {autoSendEnabled
                      ? "Review requests are sent automatically when scheduled"
                      : "Review requests require manual approval before sending"}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSendEnabled}
                    onChange={(e) => setAutoSendEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Approval Queue Info - shown when auto-send is OFF */}
              {!autoSendEnabled && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    Approval Queue Enabled
                  </div>
                  <p className="text-sm text-blue-700">
                    New review requests will appear in the &quot;Needs Approval&quot; queue.
                    You must manually approve each request before it will be sent.
                  </p>
                </div>
              )}

              {/* Business Hours */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                  <Clock className="w-4 h-4" />
                  Business Hours
                </div>
                <p className="text-sm text-blue-700">
                  Review requests are only sent Monday–Friday, 9:00 AM – 6:00 PM CST
                </p>
              </div>

              {/* SMS Template Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMS Template Preview
                </label>
                <div className="p-4 bg-gray-100 rounded-lg text-sm text-gray-700 font-mono">
                  Hi [FirstName]! Thank you for contacting TCDS Insurance
                  today. Your feedback helps us serve our clients better. If you
                  have a moment, please leave us a review:{" "}
                  <span className="text-blue-600">[Google Review Link]</span>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingSettings ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import Google Reviews</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Paste review data in one of these formats:
              </p>
              <ul className="text-sm text-gray-500 mb-4 space-y-1">
                <li>
                  • <strong>Simple:</strong> Name | Rating | Comment (one per
                  line)
                </li>
                <li>
                  • <strong>JSON:</strong> Array of objects with reviewerName,
                  rating, comment
                </li>
              </ul>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="John Smith | 5 | Great service!
Jane Doe | 4 | Very helpful staff"
                rows={10}
                className="w-full p-3 border rounded-lg font-mono text-sm resize-none"
              />
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import Reviews
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {value}
        {suffix && <span className="text-yellow-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
