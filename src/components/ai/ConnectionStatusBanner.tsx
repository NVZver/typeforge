'use client';

import { useEffect, useState, useCallback } from 'react';
import { aiCoach } from '@/lib/ai-coach';

interface ConnectionStatusBannerProps {
  onConnectionChange: (connected: boolean) => void;
}

export function ConnectionStatusBanner({ onConnectionChange }: ConnectionStatusBannerProps) {
  const [connected, setConnected] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    const result = await aiCoach.testConnection();
    setConnected(result.success);
    setModelName(result.modelName || null);
    setChecking(false);
    onConnectionChange(result.success);
  }, [onConnectionChange]);

  useEffect(() => {
    checkConnection();

    // Poll connection status every 60 seconds
    const pollInterval = setInterval(() => {
      checkConnection();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [checkConnection]);

  return (
    <div className="connection-status-banner">
      <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
      <div className="connection-info">
        {checking ? (
          <span className="connection-checking">Checking connection...</span>
        ) : connected ? (
          <>
            <span className="model-name">{modelName}</span>
            <span className="connection-label">Connected</span>
          </>
        ) : (
          <>
            <span className="connection-error">LM Studio not connected</span>
            <button onClick={checkConnection} className="reconnect-btn">
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
