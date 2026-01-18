'use client';

/**
 * Bridge Status Component
 * =======================
 * Displays VM Bridge health status and allows restart.
 * Used in Agency Settings page.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Server, Wifi, Phone, Activity } from 'lucide-react';

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

export function BridgeStatus() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            VM Bridge Status
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor the 3CX transcription bridge and WebSocket connection
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bridge Status */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">Bridge</span>
            </div>
            {loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isOnline
                ? 'Bridge is running and responding'
                : health?.message || 'Unable to connect'}
            </p>
          )}
        </div>

        {/* 3CX WebSocket */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">3CX WebSocket</span>
            </div>
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <Badge variant={threecxConnected ? 'default' : 'secondary'}>
                {threecxConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-4 w-36" />
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {threecxConnected
                ? 'Receiving call events'
                : 'Not receiving events'}
            </p>
          )}
        </div>

        {/* SIP Registrations */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">SIP Registrations</span>
            </div>
            {loading ? (
              <Skeleton className="h-6 w-10" />
            ) : (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {health?.data?.registrations ?? 0}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Virtual extensions registered
          </p>
        </div>

        {/* Active Sessions */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">Active Sessions</span>
            </div>
            {loading ? (
              <Skeleton className="h-6 w-10" />
            ) : (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {health?.data?.sessions?.active ?? 0}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {health?.data?.sessions?.streaming ?? 0} streaming, {health?.data?.sessions?.total ?? 0} total
          </p>
        </div>
      </div>

      {/* Monitored Extensions */}
      {health?.data?.autoTranscription && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
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
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last updated: {new Date(health.data.timestamp).toLocaleString()}
        </p>
      )}

      {/* Restart Section */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
        <h3 className="font-medium text-red-900 dark:text-red-200 mb-1 text-sm">
          Danger Zone
        </h3>
        <p className="text-xs text-red-700 dark:text-red-300 mb-3">
          Restart the bridge if experiencing issues. Active calls may be interrupted.
        </p>

        {!showRestartConfirm ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowRestartConfirm(true)}
            disabled={restarting}
          >
            {restarting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
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

export default BridgeStatus;
