"""
WebSocket endpoint and connection management for real-time communication.
Handles client connections, message broadcasting, and event distribution.
"""
import asyncio
import json
import time
from datetime import datetime
from typing import Dict, Set, List, Optional, Any
from collections import defaultdict
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.responses import HTMLResponse
import structlog

from app.core.config import settings
from app.core.security import get_current_user_optional
from app.models.user import User

# Configure logging
logger = structlog.get_logger(__name__)

router = APIRouter()


class ConnectionInfo:
    """Information about a WebSocket connection."""
    
    def __init__(self, client_id: str, websocket: WebSocket, user: Optional[User] = None):
        self.client_id = client_id
        self.websocket = websocket
        self.user = user
        self.connected_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.rooms: Set[str] = set()
        self.metadata: Dict[str, Any] = {}
        self.message_count = 0
        self.rate_limit_window = []


class ConnectionManager:
    """Manages WebSocket connections and message broadcasting."""
    
    def __init__(self):
        self.active_connections: Dict[str, ConnectionInfo] = {}
        self.rooms: Dict[str, Set[str]] = defaultdict(set)
        self.message_history: List[Dict[str, Any]] = []
        self.max_connections = 100
        self.rate_limit_messages = 100
        self.rate_limit_window = 60  # seconds
        self.max_message_history = 1000
        
    async def connect(self, client_id: str, websocket: WebSocket, user: Optional[User] = None) -> bool:
        """Connect a new client."""
        # Check connection limit
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Maximum connections reached")
            return False
            
        # Accept connection
        await websocket.accept()
        
        # Store connection info
        connection = ConnectionInfo(client_id, websocket, user)
        self.active_connections[client_id] = connection
        
        # Send handshake
        await self.send_personal_message(client_id, {
            "type": "connection.established",
            "data": {
                "sessionId": client_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        })
        
        logger.info("websocket_connected", client_id=client_id, user_id=user.id if user else None)
        return True
        
    async def disconnect(self, client_id: str):
        """Disconnect a client."""
        if client_id in self.active_connections:
            connection = self.active_connections[client_id]
            
            # Remove from rooms
            for room in connection.rooms:
                self.leave_room(client_id, room)
                
            # Remove connection
            del self.active_connections[client_id]
            
            logger.info("websocket_disconnected", client_id=client_id)
            
    def get_client_info(self, client_id: str) -> Optional[ConnectionInfo]:
        """Get information about a connected client."""
        return self.active_connections.get(client_id)
        
    async def send_personal_message(self, client_id: str, message: Dict[str, Any]):
        """Send a message to a specific client."""
        if client_id in self.active_connections:
            connection = self.active_connections[client_id]
            try:
                await connection.websocket.send_json(message)
                connection.last_activity = datetime.utcnow()
                connection.message_count += 1
            except Exception as e:
                logger.error("websocket_send_error", client_id=client_id, error=str(e))
                await self.disconnect(client_id)
                
    async def broadcast(self, message: Dict[str, Any], exclude: Optional[Set[str]] = None):
        """Broadcast a message to all connected clients."""
        exclude = exclude or set()
        disconnected_clients = []
        
        # Add to message history
        self.add_to_history(message)
        
        # Send to all clients
        for client_id, connection in self.active_connections.items():
            if client_id not in exclude:
                try:
                    await connection.websocket.send_json(message)
                    connection.last_activity = datetime.utcnow()
                    connection.message_count += 1
                except Exception as e:
                    logger.error("websocket_broadcast_error", client_id=client_id, error=str(e))
                    disconnected_clients.append(client_id)
                    
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self.disconnect(client_id)
            
    async def broadcast_to_room(self, room: str, message: Dict[str, Any], exclude: Optional[Set[str]] = None):
        """Broadcast a message to all clients in a room."""
        exclude = exclude or set()
        room_clients = self.rooms.get(room, set())
        
        for client_id in room_clients:
            if client_id not in exclude:
                await self.send_personal_message(client_id, message)
                
    async def join_room(self, client_id: str, room: str):
        """Add a client to a room."""
        if client_id in self.active_connections:
            self.rooms[room].add(client_id)
            self.active_connections[client_id].rooms.add(room)
            logger.info("client_joined_room", client_id=client_id, room=room)
            
    def leave_room(self, client_id: str, room: str):
        """Remove a client from a room."""
        if room in self.rooms and client_id in self.rooms[room]:
            self.rooms[room].discard(client_id)
            if not self.rooms[room]:
                del self.rooms[room]
                
        if client_id in self.active_connections:
            self.active_connections[client_id].rooms.discard(room)
            logger.info("client_left_room", client_id=client_id, room=room)
            
    def add_to_history(self, message: Dict[str, Any]):
        """Add a message to the history buffer."""
        self.message_history.append({
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Limit history size
        if len(self.message_history) > self.max_message_history:
            self.message_history = self.message_history[-self.max_message_history:]
            
    async def check_connection_health(self, client_id: str) -> bool:
        """Check if a connection is healthy."""
        if client_id not in self.active_connections:
            return False
            
        connection = self.active_connections[client_id]
        try:
            # Send a ping
            await connection.websocket.send_json({"type": "ping", "timestamp": time.time()})
            return True
        except Exception:
            await self.disconnect(client_id)
            return False
            
    def check_rate_limit(self, client_id: str) -> bool:
        """Check if a client has exceeded the rate limit."""
        if client_id not in self.active_connections:
            return False
            
        connection = self.active_connections[client_id]
        current_time = time.time()
        
        # Clean old entries
        connection.rate_limit_window = [
            timestamp for timestamp in connection.rate_limit_window
            if current_time - timestamp < self.rate_limit_window
        ]
        
        # Check limit
        if len(connection.rate_limit_window) >= self.rate_limit_messages:
            return True
            
        # Add current timestamp
        connection.rate_limit_window.append(current_time)
        return False
        
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get statistics about active connections."""
        total_connections = len(self.active_connections)
        total_rooms = len(self.rooms)
        clients_per_room = {
            room: len(clients) for room, clients in self.rooms.items()
        }
        
        return {
            "total_connections": total_connections,
            "total_rooms": total_rooms,
            "clients_per_room": clients_per_room,
            "message_history_size": len(self.message_history)
        }


# Create global connection manager
connection_manager = ConnectionManager()


class EventBroadcaster:
    """Handles broadcasting of typed events."""
    
    def __init__(self, manager: ConnectionManager):
        self.manager = manager
        
    async def broadcast_report_progress(
        self,
        report_id: str,
        progress: int,
        stage: str,
        room: Optional[str] = None
    ):
        """Broadcast report processing progress."""
        message = {
            "type": "report.progress",
            "data": {
                "reportId": report_id,
                "progress": progress,
                "stage": stage,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if room:
            await self.manager.broadcast_to_room(room, message)
        else:
            await self.manager.broadcast(message)
            
    async def broadcast_finding_created(self, finding: Dict[str, Any], room: Optional[str] = None):
        """Broadcast new finding creation."""
        message = {
            "type": "finding.created",
            "data": finding
        }
        
        if room:
            await self.manager.broadcast_to_room(room, message)
        else:
            await self.manager.broadcast(message)
            
    async def broadcast_finding_updated(
        self,
        finding_id: str,
        changes: Dict[str, Any],
        room: Optional[str] = None
    ):
        """Broadcast finding update."""
        message = {
            "type": "finding.updated",
            "data": {
                "id": finding_id,
                "changes": changes,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if room:
            await self.manager.broadcast_to_room(room, message)
        else:
            await self.manager.broadcast(message)
            
    async def broadcast_system_notification(
        self,
        level: str,
        message_text: str,
        room: Optional[str] = None
    ):
        """Broadcast system notification."""
        message = {
            "type": "system.notification",
            "data": {
                "level": level,
                "message": message_text,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if room:
            await self.manager.broadcast_to_room(room, message)
        else:
            await self.manager.broadcast(message)
            
    async def broadcast_bulk_progress(
        self,
        operation: str,
        current: int,
        total: int,
        room: Optional[str] = None
    ):
        """Broadcast bulk operation progress."""
        message = {
            "type": "bulk.progress",
            "data": {
                "operation": operation,
                "current": current,
                "total": total,
                "percentage": round((current / total) * 100, 2) if total > 0 else 0,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if room:
            await self.manager.broadcast_to_room(room, message)
        else:
            await self.manager.broadcast(message)


# Create global event broadcaster
event_broadcaster = EventBroadcaster(connection_manager)


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    token: Optional[str] = Query(None),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """WebSocket endpoint for real-time communication."""
    # Connect client
    connected = await connection_manager.connect(client_id, websocket, user)
    if not connected:
        return
        
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            # Check rate limit
            if connection_manager.check_rate_limit(client_id):
                await connection_manager.send_personal_message(client_id, {
                    "type": "error",
                    "error": "rate_limit_exceeded",
                    "retryAfter": connection_manager.rate_limit_window
                })
                continue
                
            try:
                message = json.loads(data)
                await handle_message(client_id, message)
            except json.JSONDecodeError:
                await connection_manager.send_personal_message(client_id, {
                    "type": "error",
                    "error": "invalid_message_format",
                    "details": "Message must be valid JSON"
                })
            except Exception as e:
                logger.error("websocket_message_error", client_id=client_id, error=str(e))
                await connection_manager.send_personal_message(client_id, {
                    "type": "error",
                    "error": "processing_error",
                    "details": str(e)
                })
                
    except WebSocketDisconnect:
        await connection_manager.disconnect(client_id)
    except Exception as e:
        logger.error("websocket_error", client_id=client_id, error=str(e))
        await connection_manager.disconnect(client_id)


async def handle_message(client_id: str, message: Dict[str, Any]):
    """Handle incoming WebSocket messages."""
    message_type = message.get("type")
    data = message.get("data", {})
    
    # Handle different message types
    if message_type == "ping":
        # Respond to ping
        await connection_manager.send_personal_message(client_id, {
            "type": "pong",
            "timestamp": message.get("timestamp")
        })
        
    elif message_type == "join.room":
        # Join a room
        room = data.get("room")
        if room:
            await connection_manager.join_room(client_id, room)
            await connection_manager.send_personal_message(client_id, {
                "type": "room.joined",
                "data": {"room": room}
            })
            
    elif message_type == "leave.room":
        # Leave a room
        room = data.get("room")
        if room:
            connection_manager.leave_room(client_id, room)
            await connection_manager.send_personal_message(client_id, {
                "type": "room.left",
                "data": {"room": room}
            })
            
    elif message_type == "broadcast.test":
        # Test broadcast
        await connection_manager.broadcast({
            "type": "broadcast.received",
            "data": data
        }, exclude={client_id})
        
        # Echo back to sender
        await connection_manager.send_personal_message(client_id, {
            "type": "broadcast.received",
            "data": data
        })
        
    elif message_type == "api.request":
        # Handle API request over WebSocket (fallback)
        correlation_id = message.get("correlationId")
        if correlation_id:
            # Process request (simplified for now)
            await connection_manager.send_personal_message(client_id, {
                "type": "response",
                "correlationId": correlation_id,
                "data": {"status": "processed"}
            })
            
    else:
        # Unknown message type
        await connection_manager.send_personal_message(client_id, {
            "type": "error",
            "error": "unknown_message_type",
            "details": f"Unknown message type: {message_type}"
        })


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    return connection_manager.get_connection_stats()


# Export for use in other modules
__all__ = ["router", "connection_manager", "event_broadcaster"]