/**
 * WebSocket Controller
 * Handles WebSocket connections and streaming
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { OpenRouterService } from '../services/openrouterService';
import { ModelRegistryService } from '../services/modelRegistryService';
import { logger, createRequestLogger, logWebSocket } from '../utils/logger';
import { estimatePromptTokens } from '../utils/costCalculator';
import {
  WebSocketMessage,
  WebSocketInferenceRequest,
  WebSocketInferenceResponse,
  WebSocketError,
  WebSocketHeartbeat,
  WebSocketConnection,
  WebSocketStats,
} from '../types/websocket';
import { validateWebSocketMessage } from '../middleware/validation';
import { websocketRateLimiter } from '../middleware/rateLimiting';

export class WebSocketController {
  private connections: Map<string, WebSocketConnection> = new Map();
  private wss: WebSocketServer;
  private openrouterService: OpenRouterService;
  private modelRegistryService: ModelRegistryService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private stats: WebSocketStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    totalErrors: 0,
    averageConnectionDuration: 0,
    peakConnections: 0,
  };

  constructor(
    wss: WebSocketServer,
    openrouterService: OpenRouterService,
    modelRegistryService: ModelRegistryService
  ) {
    this.wss = wss;
    this.openrouterService = openrouterService;
    this.modelRegistryService = modelRegistryService;
    
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error: Error) => {
      logger.error({ error: error.message }, 'WebSocket server error');
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connectionId = uuidv4();
    const ip = req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Rate limiting check
    if (!websocketRateLimiter(ip, 5)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    const connection: WebSocketConnection = {
      id: connectionId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      ip,
      userAgent,
    };

    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.stats.activeConnections);

    const connectionLogger = createRequestLogger({ connectionId, ip });
    logWebSocket({ connectionId, ip }, 'WebSocket connection established');

    // Send welcome message
    this.sendMessage(ws, {
      type: 'heartbeat',
      timestamp: Date.now(),
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, connectionId, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(connectionId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      this.handleError(connectionId, error);
    });

    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.lastActivity = Date.now();
      }
    });
  }

  private handleMessage(ws: WebSocket, connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();
    this.stats.totalMessages++;

    try {
      const message = JSON.parse(data.toString());
      const validation = validateWebSocketMessage(message);

      if (!validation.valid) {
        this.sendError(ws, connectionId, validation.error!);
        return;
      }

      this.processMessage(ws, connectionId, validation.data!);
    } catch (error: any) {
      this.stats.totalErrors++;
      this.sendError(ws, connectionId, {
        code: 400,
        message: 'Invalid JSON message',
        type: 'validation',
      });
    }
  }

  private async processMessage(ws: WebSocket, connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const connectionLogger = createRequestLogger({ connectionId });

    switch (message.type) {
      case 'inference_request':
        await this.handleInferenceRequest(ws, connectionId, message as WebSocketInferenceRequest);
        break;

      case 'heartbeat':
        this.handleHeartbeat(ws, connectionId);
        break;

      case 'close':
        this.handleClose(ws, connectionId, message.reason || 'Client requested close');
        break;

      default:
        this.sendError(ws, connectionId, {
          code: 400,
          message: `Unknown message type: ${message.type}`,
          type: 'validation',
        });
    }
  }

  private async handleInferenceRequest(ws: WebSocket, connectionId: string, message: WebSocketInferenceRequest): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const requestId = message.id;
    const startTime = Date.now();
    const connectionLogger = createRequestLogger({ connectionId, requestId });

    try {
      // Validate model
      const modelExists = await this.modelRegistryService.validateModel(message.data.model);
      if (!modelExists) {
        this.sendError(ws, connectionId, {
          code: 400,
          message: `Model '${message.data.model}' not found or not supported`,
          type: 'validation',
        });
        return;
      }

      connection.currentRequestId = requestId;
      logWebSocket({ connectionId, requestId }, 'WebSocket inference request started');

      // Create streaming completion
      const stream = await this.openrouterService.createStreamingCompletion(message.data);
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let content = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            try {
              const data = JSON.parse(line);
              
              // Track content for token estimation
              if (data.choices?.[0]?.delta?.content) {
                content += data.choices[0].delta.content;
              }

              // Send response to client
              const response: WebSocketInferenceResponse = {
                type: 'inference_response',
                id: requestId,
                data: {
                  content: data.choices?.[0]?.delta?.content,
                  finish_reason: data.choices?.[0]?.finish_reason,
                  usage: data.usage,
                  model: data.model,
                  created: data.created,
                },
              };

              this.sendMessage(ws, response);
            } catch (parseError) {
              // Ignore invalid JSON
            }
          }
        }

        // Estimate tokens using proper tokenization
        promptTokens = estimatePromptTokens(message.data.messages);
        completionTokens = Math.ceil(content.length / 4); // Still simplified for completion
        totalTokens = promptTokens + completionTokens;


        logWebSocket({ connectionId, requestId }, 'WebSocket inference request completed');

      } finally {
        reader.cancel();
        connection.currentRequestId = undefined;
      }
    } catch (error: any) {
      this.stats.totalErrors++;
      connection.currentRequestId = undefined;


      this.sendError(ws, connectionId, {
        code: 500,
        message: error.message || 'Internal server error',
        type: 'internal',
      });

      connectionLogger.error('WebSocket inference request failed', { error: error.message });
    }
  }

  private handleHeartbeat(ws: WebSocket, connectionId: string): void {
    const response: WebSocketHeartbeat = {
      type: 'heartbeat',
      timestamp: Date.now(),
    };

    this.sendMessage(ws, response);
  }

  private handleClose(ws: WebSocket, connectionId: string, reason: string): void {
    ws.close(1000, reason);
  }

  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.isActive = false;
    this.stats.activeConnections--;

    const duration = Date.now() - connection.connectedAt;
    this.stats.averageConnectionDuration = 
      (this.stats.averageConnectionDuration * (this.stats.totalConnections - 1) + duration) / this.stats.totalConnections;

    logWebSocket({ connectionId, duration, code, reason }, 'WebSocket connection closed');

    // Clean up after a delay
    setTimeout(() => {
      this.connections.delete(connectionId);
    }, 30000); // 30 seconds
  }

  private handleError(connectionId: string, error: Error): void {
    this.stats.totalErrors++;
    logWebSocket({ connectionId, error: error as Error }, 'WebSocket error occurred');
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, connectionId: string, error: any): void {
    const errorMessage: WebSocketError = {
      type: 'error',
      id: connectionId,
      error: {
        code: error.code || 500,
        message: error.message || 'Unknown error',
        type: error.type || 'internal',
        details: error.details,
      },
    };

    this.sendMessage(ws, errorMessage);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastActivity > timeout) {
          logWebSocket({ connectionId }, 'WebSocket connection timed out');
          connection.isActive = false;
          this.stats.activeConnections--;
        } else if (connection.isActive) {
          // Send ping to all active connections
          for (const ws of this.wss.clients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.ping();
            }
          }
        }
      }
    }, 30000); // 30 seconds
  }


  getStats(): WebSocketStats {
    return { ...this.stats };
  }

  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  closeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const ws = Array.from(this.wss.clients).find((client: any) => client.connectionId === connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Server requested close');
    }

    this.connections.delete(connectionId);
    this.stats.activeConnections--;

    return true;
  }

  closeAllConnections(): void {
    for (const [connectionId] of this.connections.entries()) {
      this.closeConnection(connectionId);
    }
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.closeAllConnections();
    this.wss.close();
  }
}
