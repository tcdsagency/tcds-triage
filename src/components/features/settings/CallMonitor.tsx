'use client';

/**
 * Call Monitor Component
 * ======================
 * Displays call discrepancies and allows fixes.
 * Used in Agency Settings page.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone,
  MessageSquare,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Link2,
  Wrench,
  Trash2,
} from 'lucide-react';

interface CallMonitorData {
  success: boolean;
  timeRange: string;
  stats: {
    totalCalls: number;
    transcribedCalls: number;
    missingTranscriptCount: number;
    unfinishedTranscriptCount: number;
    orphanedTriageCount: number;
    staleCallCount: number;
  };
  discrepancies: {
    missingTranscripts: Array<{
      id: string;
      direction: string;
      fromNumber: string;
      toNumber: string;
      status: string;
      vmSessionId: string;
      extension: string;
      createdAt: string;
      agentName: string | null;
      segmentCount: number;
    }>;
    unfinishedTranscripts: Array<{
      id: string;
      direction: string;
      fromNumber: string;
      toNumber: string;
      status: string;
      vmSessionId: string;
      extension: string;
      createdAt: string;
      agentName: string | null;
      segmentCount: number;
    }>;
    orphanedTriageItems: Array<{
      id: string;
      type: string;
      status: string;
      title: string;
      description: string;
      createdAt: string;
      messageId: string;
      messagePhone: string;
      messageBody: string;
    }>;
    staleCalls: Array<{
      id: string;
      direction: string;
      fromNumber: string;
      toNumber: string;
      status: string;
      extension: string;
      createdAt: string;
      agentName: string | null;
      minutesOld: number;
      type: string;
    }>;
  };
}

export function CallMonitor() {
  const [data, setData] = useState<CallMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [fixing, setFixing] = useState<string | null>(null);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    missingTranscripts: true,
    unfinishedTranscripts: true,
    orphanedTriage: true,
    staleCalls: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/call-monitor?range=${timeRange}`);
      const result = await res.json();
      setData(result);
    } catch {
      toast.error('Failed to fetch call monitor data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFix = async (action: string, payload: Record<string, any>) => {
    const key = `${action}-${payload.id || payload.ids?.join(',') || 'all'}`;
    setFixing(key);

    try {
      const res = await fetch('/api/settings/call-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.error || 'Fix failed');
      }
    } catch {
      toast.error('Failed to apply fix');
    } finally {
      setFixing(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const totalIssues =
    (data?.stats.missingTranscriptCount || 0) +
    (data?.stats.unfinishedTranscriptCount || 0) +
    (data?.stats.orphanedTriageCount || 0) +
    (data?.stats.staleCallCount || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Call Accountability Monitor
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Detect and fix discrepancies in call processing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={e => {
              setTimeRange(e.target.value);
              setLoading(true);
            }}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Phone className="w-4 h-4 text-blue-500" />
            {loading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data?.stats.totalCalls || 0}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Calls</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <FileText className="w-4 h-4 text-green-500" />
            {loading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data?.stats.transcribedCalls || 0}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Transcribed</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <AlertTriangle className={`w-4 h-4 ${totalIssues > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            {loading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <span className={`text-xl font-bold ${totalIssues > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {totalIssues}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Issues</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between">
            {totalIssues === 0 ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Wrench className="w-4 h-4 text-amber-500" />
            )}
            {loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant={totalIssues === 0 ? 'default' : 'secondary'} className="text-xs">
                {totalIssues === 0 ? 'Healthy' : 'Attention'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status</p>
        </div>
      </div>

      {/* Clear All Button */}
      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm('Clear all active calls? This will mark ringing calls as missed and in-progress calls as completed.')) {
              handleFix('clear_all_active_calls', {});
            }
          }}
          disabled={fixing === 'clear_all_active_calls-all'}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Active Calls
        </Button>
      </div>

      {/* Discrepancy Sections */}
      <div className="space-y-3">
        {/* Unfinished Transcripts */}
        {(data?.discrepancies.unfinishedTranscripts.length || 0) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('unfinishedTranscripts')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  Unfinished Transcripts
                </span>
                <Badge variant="secondary" className="text-xs">
                  {data?.discrepancies.unfinishedTranscripts.length || 0}
                </Badge>
              </div>
              {expandedSections.unfinishedTranscripts ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expandedSections.unfinishedTranscripts && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Calls with segments but no compiled transcript
                </p>
                {(data?.discrepancies.unfinishedTranscripts.length || 0) > 0 && (
                  <div className="mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleFix('rebuild_all_transcripts', {
                          ids: data?.discrepancies.unfinishedTranscripts.map(c => c.id),
                        })
                      }
                      disabled={fixing?.startsWith('rebuild_all')}
                    >
                      <Wrench className="w-3 h-3 mr-1" />
                      Rebuild All ({data?.discrepancies.unfinishedTranscripts.length})
                    </Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">From</th>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Segments</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.unfinishedTranscripts.slice(0, 5).map(call => (
                        <tr key={call.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2">{call.fromNumber}</td>
                          <td className="py-2">{call.agentName || call.extension || '-'}</td>
                          <td className="py-2 text-gray-500">{formatTime(call.createdAt)}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">{call.segmentCount}</Badge>
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => handleFix('rebuild_transcript', { id: call.id })}
                              disabled={fixing === `rebuild_transcript-${call.id}`}
                            >
                              {fixing === `rebuild_transcript-${call.id}` ? '...' : 'Rebuild'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Missing Transcripts */}
        {(data?.discrepancies.missingTranscripts.filter(c => c.segmentCount === 0).length || 0) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('missingTranscripts')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  Missing Transcripts
                </span>
                <Badge variant="destructive" className="text-xs">
                  {data?.discrepancies.missingTranscripts.filter(c => c.segmentCount === 0).length || 0}
                </Badge>
              </div>
              {expandedSections.missingTranscripts ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expandedSections.missingTranscripts && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Calls with VM session but no transcript data
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">Direction</th>
                        <th className="pb-2 font-medium">From</th>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.missingTranscripts
                        .filter(c => c.segmentCount === 0)
                        .slice(0, 5)
                        .map(call => (
                          <tr key={call.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2">{call.direction}</td>
                            <td className="py-2">{call.fromNumber}</td>
                            <td className="py-2">{call.agentName || call.extension || '-'}</td>
                            <td className="py-2 text-gray-500">{formatTime(call.createdAt)}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">{call.status}</Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Orphaned After-Hours Items */}
        {(data?.discrepancies.orphanedTriageItems.length || 0) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('orphanedTriage')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  Orphaned After-Hours Items
                </span>
                <Badge variant="secondary" className="text-xs">
                  {data?.discrepancies.orphanedTriageItems.length || 0}
                </Badge>
              </div>
              {expandedSections.orphanedTriage ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expandedSections.orphanedTriage && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Triage items linked to messages but not calls
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">Title</th>
                        <th className="pb-2 font-medium">Phone</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.orphanedTriageItems.slice(0, 5).map(item => (
                        <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 font-medium">{item.title}</td>
                          <td className="py-2">{item.messagePhone || '-'}</td>
                          <td className="py-2 text-gray-500">{formatTime(item.createdAt)}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => handleFix('auto_link_triage', { id: item.id })}
                              disabled={fixing === `auto_link_triage-${item.id}`}
                            >
                              <Link2 className="w-3 h-3 mr-1" />
                              {fixing === `auto_link_triage-${item.id}` ? '...' : 'Link'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stale Calls */}
        {(data?.discrepancies.staleCalls.length || 0) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('staleCalls')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  Stale Calls
                </span>
                <Badge variant="secondary" className="text-xs">
                  {data?.discrepancies.staleCalls.length || 0}
                </Badge>
              </div>
              {expandedSections.staleCalls ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expandedSections.staleCalls && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Calls stuck in ringing/in_progress status
                </p>
                {(data?.discrepancies.staleCalls.length || 0) > 0 && (
                  <div className="mb-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleFix('mark_stale_missed', {
                          ids: data?.discrepancies.staleCalls
                            .filter(c => c.status === 'ringing')
                            .map(c => c.id),
                        })
                      }
                      disabled={fixing?.startsWith('mark_stale_missed')}
                    >
                      Mark Ringing Missed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleFix('mark_stale_completed', {
                          ids: data?.discrepancies.staleCalls
                            .filter(c => c.status === 'in_progress')
                            .map(c => c.id),
                        })
                      }
                      disabled={fixing?.startsWith('mark_stale_completed')}
                    >
                      Mark In-Progress Completed
                    </Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">From</th>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Age</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.staleCalls.slice(0, 5).map(call => (
                        <tr key={call.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2">{call.fromNumber}</td>
                          <td className="py-2">{call.agentName || call.extension || '-'}</td>
                          <td className="py-2">
                            <Badge variant={call.status === 'ringing' ? 'destructive' : 'secondary'} className="text-xs">
                              {call.status}
                            </Badge>
                          </td>
                          <td className="py-2 text-amber-600 dark:text-amber-400">
                            {formatDuration(call.minutesOld)}
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() =>
                                handleFix(
                                  call.status === 'ringing' ? 'mark_stale_missed' : 'mark_stale_completed',
                                  { id: call.id }
                                )
                              }
                              disabled={fixing?.includes(call.id)}
                            >
                              {call.status === 'ringing' ? 'Miss' : 'Complete'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* All Clear */}
        {!loading && totalIssues === 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-medium text-green-900 dark:text-green-200 text-sm mb-1">
              All Systems Healthy
            </h3>
            <p className="text-xs text-green-700 dark:text-green-300">
              No discrepancies found in the selected time range
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallMonitor;
