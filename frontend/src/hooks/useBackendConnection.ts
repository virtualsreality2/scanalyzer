/**
 * useBackendConnection - WebSocket connection management hook
 * Handles connection, reconnection, event subscriptions, and message queuing
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface BackendConnectionOptions {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

interface EventHandler {
  event: string;
  handler: (data: any) => void;
}

interface QueuedMessage {
  type: string;
  data: any;
  timestamp: number;
}

export function useBackendConnection(options: BackendConnectionOptions = {}) {
  const {
    url = 'ws://localhost:8000/ws',
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { setBackendConnected, setBackendVersion } = useAppStore();

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Clear heartbeat interval
  const clearHeartbeatInterval = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    clearHeartbeatInterval();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, clearHeartbeatInterval]);

  // Process message queue
  const processMessageQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      while (messageQueueRef.current.length > 0) {
        const message = messageQueueRef.current.shift();
        if (message) {
          wsRef.current.send(JSON.stringify(message));
        }
      }
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');
    clearReconnectTimeout();

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionState('connected');
        setBackendConnected(true);
        setReconnectAttempts(0);
        
        // Send queued messages
        processMessageQueue();
        
        // Start heartbeat
        startHeartbeat();
        
        // Request backend info
        wsRef.current?.send(JSON.stringify({ type: 'info' }));
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event);
        setConnectionState('disconnected');
        setBackendConnected(false);
        clearHeartbeatInterval();
        
        // Attempt reconnection
        if (reconnect && reconnectAttempts < maxReconnectAttempts) {
          setConnectionState('reconnecting');
          setReconnectAttempts(prev => prev + 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * Math.min(reconnectAttempts + 1, 5)); // Exponential backoff
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setConnectionState('error');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle system messages
          if (message.type === 'pong') {
            // Heartbeat response
            return;
          }
          
          if (message.type === 'info') {
            setBackendVersion(message.data.version);
            return;
          }
          
          // Dispatch to event handlers
          if (message.event) {
            const handlers = eventHandlersRef.current.get(message.event);
            if (handlers) {
              handlers.forEach(handler => handler(message.data));
            }
          }
          
          // Global message handler
          const globalHandlers = eventHandlersRef.current.get('*');
          if (globalHandlers) {
            globalHandlers.forEach(handler => handler(message));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionState('error');
    }
  }, [
    url,
    reconnect,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectInterval,
    setBackendConnected,
    setBackendVersion,
    clearReconnectTimeout,
    clearHeartbeatInterval,
    processMessageQueue,
    startHeartbeat
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearHeartbeatInterval();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionState('disconnected');
    setBackendConnected(false);
  }, [clearReconnectTimeout, clearHeartbeatInterval, setBackendConnected]);

  // Send message
  const send = useCallback((message: { type: string; data?: any }) => {
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now()
    };
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageWithTimestamp));
    } else {
      // Queue message if not connected
      messageQueueRef.current.push(messageWithTimestamp);
    }
  }, []);

  // Subscribe to events
  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event)?.add(handler);
    
    // Return unsubscribe function
    return () => {
      eventHandlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  // Unsubscribe from events
  const unsubscribe = useCallback((event: string, handler: (data: any) => void) => {
    eventHandlersRef.current.get(event)?.delete(handler);
  }, []);

  // Emit event (for testing)
  const emit = useCallback((event: string, data: any) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []); // Only run on mount/unmount

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHeartbeatInterval();
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        startHeartbeat();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearHeartbeatInterval, startHeartbeat]);

  return {
    // Connection state
    isConnected: connectionState === 'connected',
    connectionState,
    reconnectAttempts,
    
    // Actions
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    emit,
    
    // Message queue (for debugging/testing)
    messageQueue: messageQueueRef.current
  };
}