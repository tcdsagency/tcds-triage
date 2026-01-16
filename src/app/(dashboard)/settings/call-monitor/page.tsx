'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
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

export default function CallMonitorPage() {
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
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
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
        fetchData(); // Refresh data
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/settings" className="hover:text-gray-700 dark:hover:text-gray-200">
              Settings
            </Link>
            <span>/</span>
            <span>Call Monitor</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Call Accountability Monitor
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Detect and fix discrepancies in call processing
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={e => {
              setTimeRange(e.target.value);
              setLoading(true);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <Phone className="w-5 h-5 text-blue-500" />
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.totalCalls || 0}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Calls</p>
        </div>

        {/* With Transcript */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <FileText className="w-5 h-5 text-green-500" />
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.transcribedCalls || 0}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">With Transcript</p>
        </div>

        {/* Issues Found */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className={`w-5 h-5 ${totalIssues > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className={`text-2xl font-bold ${totalIssues > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {totalIssues}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Issues Found</p>
        </div>

        {/* Health */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            {totalIssues === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Wrench className="w-5 h-5 text-amber-500" />
            )}
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={totalIssues === 0 ? 'default' : 'secondary'}>
                {totalIssues === 0 ? 'Healthy' : 'Needs Attention'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">System Health</p>
        </div>
      </div>

      {/* Discrepancy Sections */}
      <div className="space-y-4">
        {/* Unfinished Transcripts (have segments but no final transcript) */}
        {(data?.discrepancies.unfinishedTranscripts.length || 0) > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('unfinishedTranscripts')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Unfinished Transcripts
                </span>
                <Badge variant="secondary">
                  {data?.discrepancies.unfinishedTranscripts.length || 0}
                </Badge>
              </div>
              {expandedSections.unfinishedTranscripts ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.unfinishedTranscripts && (
              <div className="px-6 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Calls with transcript segments but no compiled transcript
                </p>
                {(data?.discrepancies.unfinishedTranscripts.length || 0) > 0 && (
                  <div className="mb-3">
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
                      <Wrench className="w-4 h-4 mr-2" />
                      Rebuild All ({data?.discrepancies.unfinishedTranscripts.length})
                    </Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">ID</th>
                        <th className="pb-2 font-medium">From</th>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Segments</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.unfinishedTranscripts.map(call => (
                        <tr key={call.id} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 font-mono text-xs">{call.id.slice(0, 8)}</td>
                          <td className="py-2">{call.fromNumber}</td>
                          <td className="py-2">{call.agentName || call.extension || '-'}</td>
                          <td className="py-2 text-gray-500">{formatTime(call.createdAt)}</td>
                          <td className="py-2">
                            <Badge variant="outline">{call.segmentCount} segments</Badge>
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleFix('rebuild_transcript', { id: call.id })}
                              disabled={fixing === `rebuild_transcript-${call.id}`}
                            >
                              {fixing === `rebuild_transcript-${call.id}` ? 'Rebuilding...' : 'Rebuild'}
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

        {/* Missing Transcripts (vmSession but no segments) */}
        {(data?.discrepancies.missingTranscripts.filter(c => c.segmentCount === 0).length || 0) > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('missingTranscripts')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Missing Transcripts
                </span>
                <Badge variant="destructive">
                  {data?.discrepancies.missingTranscripts.filter(c => c.segmentCount === 0).length || 0}
                </Badge>
              </div>
              {expandedSections.missingTranscripts ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.missingTranscripts && (
              <div className="px-6 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Calls with VM session but no transcript data (transcription may have failed)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">ID</th>
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
                        .map(call => (
                          <tr key={call.id} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="py-2 font-mono text-xs">{call.id.slice(0, 8)}</td>
                            <td className="py-2">{call.direction}</td>
                            <td className="py-2">{call.fromNumber}</td>
                            <td className="py-2">{call.agentName || call.extension || '-'}</td>
                            <td className="py-2 text-gray-500">{formatTime(call.createdAt)}</td>
                            <td className="py-2">
                              <Badge variant="outline">{call.status}</Badge>
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

        {/* Orphaned After-Hours Triage Items */}
        {(data?.discrepancies.orphanedTriageItems.length || 0) > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('orphanedTriage')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Orphaned After-Hours Items
                </span>
                <Badge variant="secondary">
                  {data?.discrepancies.orphanedTriageItems.length || 0}
                </Badge>
              </div>
              {expandedSections.orphanedTriage ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.orphanedTriage && (
              <div className="px-6 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  After-hours triage items linked to messages but not calls
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">Title</th>
                        <th className="pb-2 font-medium">Phone</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.orphanedTriageItems.map(item => (
                        <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 font-medium">{item.title}</td>
                          <td className="py-2">{item.messagePhone || '-'}</td>
                          <td className="py-2 text-gray-500">{formatTime(item.createdAt)}</td>
                          <td className="py-2">
                            <Badge variant="outline">{item.status}</Badge>
                          </td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleFix('auto_link_triage', { id: item.id })}
                              disabled={fixing === `auto_link_triage-${item.id}`}
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              {fixing === `auto_link_triage-${item.id}` ? 'Linking...' : 'Auto-Link'}
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('staleCalls')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Stale Calls
                </span>
                <Badge variant="secondary">
                  {data?.discrepancies.staleCalls.length || 0}
                </Badge>
              </div>
              {expandedSections.staleCalls ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.staleCalls && (
              <div className="px-6 pb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Calls stuck in ringing/in_progress status (webhook failure)
                </p>
                {(data?.discrepancies.staleCalls.length || 0) > 0 && (
                  <div className="mb-3 flex gap-2">
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
                      Mark Ringing as Missed
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
                      Mark In Progress as Completed
                    </Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">ID</th>
                        <th className="pb-2 font-medium">From</th>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Age</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.discrepancies.staleCalls.map(call => (
                        <tr key={call.id} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 font-mono text-xs">{call.id.slice(0, 8)}</td>
                          <td className="py-2">{call.fromNumber}</td>
                          <td className="py-2">{call.agentName || call.extension || '-'}</td>
                          <td className="py-2">
                            <Badge variant={call.status === 'ringing' ? 'destructive' : 'secondary'}>
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
                              onClick={() =>
                                handleFix(
                                  call.status === 'ringing' ? 'mark_stale_missed' : 'mark_stale_completed',
                                  { id: call.id }
                                )
                              }
                              disabled={fixing?.includes(call.id)}
                            >
                              {call.status === 'ringing' ? 'Mark Missed' : 'Mark Completed'}
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
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-green-900 dark:text-green-200 mb-1">
              All Systems Healthy
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              No discrepancies found in the selected time range
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
