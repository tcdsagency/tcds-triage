'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BridgeHealth {
  success: boolean;
  status: string;
  message?: string;
  data: {
    threecx: { connected: boolean };
    registrations: number;
    sessions: { total: number; active: number; streaming: number };
    autoTranscription: { enabled: boolean; extensions: string[] };
    timestamp: string;
  } | null;
}

export default function BridgeSettingsPage() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        success: false,
        status: 'error',
        message: 'Failed to fetch bridge status',
        data: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRestart = async () => {
    setRestarting(true);
    setShowRestartConfirm(false);

    try {
      const res = await fetch('/api/bridge/restart', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success('Bridge restart initiated');
        setTimeout(fetchHealth, 5000);
      } else {
        toast.error(data.message || 'Restart failed');
      }
    } catch {
      toast.error('Failed to restart bridge');
    } finally {
      setRestarting(false);
    }
  };

  const isOnline = health?.success && health?.status === 'ok';
  const threecxConnected = health?.data?.threecx?.connected ?? false;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/settings" className="hover:text-gray-700 dark:hover:text-gray-200">
              Settings
            </Link>
            <span>/</span>
            <span>VM Bridge</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            VM Bridge Status
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor the 3CX transcription bridge and WebSocket connection
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchHealth}
          disabled={loading}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Bridge Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Bridge Status</h3>
            {loading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOnline
                ? 'Bridge is running and responding'
                : health?.message || 'Unable to connect to bridge'}
            </p>
          )}
        </div>

        {/* 3CX WebSocket */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">3CX WebSocket</h3>
            {loading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <Badge variant={threecxConnected ? 'default' : 'secondary'}>
                {threecxConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {threecxConnected
                ? 'Receiving call events from 3CX'
                : 'Not receiving call events'}
            </p>
          )}
        </div>

        {/* SIP Registrations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">SIP Registrations</h3>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {health?.data?.registrations ?? 0}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Virtual extensions registered for transcription
          </p>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Active Sessions</h3>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {health?.data?.sessions?.active ?? 0}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {health?.data?.sessions?.streaming ?? 0} streaming, {health?.data?.sessions?.total ?? 0} total
          </p>
        </div>
      </div>

      {/* Auto-Transcription Extensions */}
      {health?.data?.autoTranscription && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Monitored Extensions
          </h3>
          <div className="flex flex-wrap gap-2">
            {health.data.autoTranscription.extensions.length > 0 ? (
              health.data.autoTranscription.extensions.map((ext) => (
                <Badge key={ext} variant="outline">
                  {ext}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No extensions configured
              </p>
            )}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {health?.data?.timestamp && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Last updated: {new Date(health.data.timestamp).toLocaleString()}
        </p>
      )}

      {/* Restart Section */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
          Danger Zone
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
          Restart the VM bridge if it&apos;s not responding or experiencing issues.
          Active calls may be interrupted.
        </p>

        {!showRestartConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setShowRestartConfirm(true)}
            disabled={restarting}
          >
            {restarting ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Restarting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart Bridge
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-700 dark:text-red-300">
              Are you sure?
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRestart}
            >
              Yes, Restart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestartConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
