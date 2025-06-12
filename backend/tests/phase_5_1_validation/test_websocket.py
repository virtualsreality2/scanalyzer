"""
Phase 5.1 Backend WebSocket Tests
Tests for WebSocket endpoint, connection management, and real-time features
"""
import pytest
import asyncio
import json
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
import websockets

from app.api.websocket import (
    ConnectionManager,
    ConnectionInfo,
    EventBroadcaster,
    MessageQueue,
    RateLimiter,
    websocket_endpoint
)


class TestConnectionManager:
    """Test ConnectionManager functionality"""
    
    @pytest.fixture
    def manager(self):
        return ConnectionManager()
    
    @pytest.fixture
    def mock_websocket(self):
        ws = AsyncMock()
        ws.send_text = AsyncMock()
        ws.send_bytes = AsyncMock()
        ws.receive_text = AsyncMock()
        ws.accept = AsyncMock()
        return ws
    
    @pytest.mark.asyncio
    async def test_connect_client(self, manager, mock_websocket):
        """Test client connection and handshake"""
        client_id = "test-client-1"
        
        await manager.connect(client_id, mock_websocket)
        
        assert client_id in manager.active_connections
        assert manager.active_connections[client_id].websocket == mock_websocket
        
        # Verify handshake sent
        mock_websocket.send_text.assert_called_once()
        call_args = mock_websocket.send_text.call_args[0][0]
        message = json.loads(call_args)
        assert message["type"] == "connection.established"
        assert message["data"]["sessionId"] == client_id
    
    @pytest.mark.asyncio
    async def test_disconnect_client(self, manager, mock_websocket):
        """Test client disconnection and cleanup"""
        client_id = "test-client-1"
        
        # Connect first
        await manager.connect(client_id, mock_websocket)
        await manager.join_room(client_id, "room1")
        
        # Disconnect
        manager.disconnect(client_id)
        
        assert client_id not in manager.active_connections
        assert client_id not in manager.rooms["room1"]
    
    @pytest.mark.asyncio
    async def test_room_management(self, manager, mock_websocket):
        """Test room join/leave functionality"""
        client_id = "test-client-1"
        await manager.connect(client_id, mock_websocket)
        
        # Join room
        await manager.join_room(client_id, "room1")
        assert client_id in manager.rooms["room1"]
        
        # Leave room
        await manager.leave_room(client_id, "room1")
        assert client_id not in manager.rooms["room1"]
    
    @pytest.mark.asyncio
    async def test_broadcast_to_room(self, manager, mock_websocket):
        """Test broadcasting to room members"""
        # Connect multiple clients
        clients = {}
        for i in range(3):
            client_id = f"client-{i}"
            ws = AsyncMock()
            ws.send_text = AsyncMock()
            clients[client_id] = ws
            await manager.connect(client_id, ws)
            await manager.join_room(client_id, "test-room")
        
        # Broadcast message
        message = {"type": "test.broadcast", "data": {"value": 123}}
        await manager.broadcast_to_room("test-room", message)
        
        # Verify all clients received the message
        for ws in clients.values():
            ws.send_text.assert_called_with(json.dumps(message))
    
    @pytest.mark.asyncio
    async def test_send_personal_message(self, manager, mock_websocket):
        """Test sending message to specific client"""
        client_id = "test-client-1"
        await manager.connect(client_id, mock_websocket)
        
        message = {"type": "personal.message", "data": {"text": "Hello"}}
        await manager.send_personal_message(client_id, message)
        
        mock_websocket.send_text.assert_called_with(json.dumps(message))
    
    @pytest.mark.asyncio
    async def test_get_client_info(self, manager, mock_websocket):
        """Test retrieving client information"""
        client_id = "test-client-1"
        await manager.connect(client_id, mock_websocket)
        
        info = manager.get_client_info(client_id)
        assert info is not None
        assert info.websocket == mock_websocket
        assert info.connected_at <= datetime.now()
        assert info.rooms == set()


class TestEventBroadcaster:
    """Test EventBroadcaster functionality"""
    
    @pytest.fixture
    def broadcaster(self):
        manager = ConnectionManager()
        return EventBroadcaster(manager)
    
    @pytest.mark.asyncio
    async def test_broadcast_report_progress(self, broadcaster):
        """Test broadcasting report progress events"""
        with patch.object(broadcaster.manager, 'broadcast') as mock_broadcast:
            await broadcaster.broadcast_report_progress(
                report_id="report-123",
                progress=50,
                stage="parsing"
            )
            
            mock_broadcast.assert_called_once()
            call_args = mock_broadcast.call_args[0][0]
            assert call_args["type"] == "report.progress"
            assert call_args["data"]["reportId"] == "report-123"
            assert call_args["data"]["progress"] == 50
    
    @pytest.mark.asyncio
    async def test_broadcast_finding_created(self, broadcaster):
        """Test broadcasting finding creation events"""
        finding = {
            "id": "finding-1",
            "title": "Test Finding",
            "severity": "high"
        }
        
        with patch.object(broadcaster.manager, 'broadcast_to_room') as mock_broadcast:
            await broadcaster.broadcast_finding_created("report-123", finding)
            
            mock_broadcast.assert_called_once_with(
                "report:report-123",
                {
                    "type": "finding.created",
                    "data": finding
                }
            )
    
    @pytest.mark.asyncio
    async def test_broadcast_system_notification(self, broadcaster):
        """Test broadcasting system notifications"""
        with patch.object(broadcaster.manager, 'broadcast') as mock_broadcast:
            await broadcaster.broadcast_system_notification(
                level="warning",
                message="System maintenance scheduled"
            )
            
            call_args = mock_broadcast.call_args[0][0]
            assert call_args["type"] == "system.notification"
            assert call_args["data"]["level"] == "warning"


class TestRateLimiter:
    """Test RateLimiter functionality"""
    
    @pytest.fixture
    def limiter(self):
        return RateLimiter(max_requests=10, window_seconds=60)
    
    def test_allow_request_under_limit(self, limiter):
        """Test allowing requests under rate limit"""
        client_id = "test-client"
        
        for _ in range(10):
            assert limiter.check_rate_limit(client_id) is True
    
    def test_block_request_over_limit(self, limiter):
        """Test blocking requests over rate limit"""
        client_id = "test-client"
        
        # Use up the limit
        for _ in range(10):
            limiter.check_rate_limit(client_id)
        
        # Next request should be blocked
        assert limiter.check_rate_limit(client_id) is False
    
    def test_rate_limit_window_reset(self, limiter):
        """Test rate limit window reset"""
        client_id = "test-client"
        
        # Use up the limit
        for _ in range(10):
            limiter.check_rate_limit(client_id)
        
        # Simulate time passing
        limiter.requests[client_id] = [
            datetime.now() - timedelta(seconds=61)
            for _ in range(10)
        ]
        
        # Should allow new requests
        assert limiter.check_rate_limit(client_id) is True
    
    def test_get_reset_time(self, limiter):
        """Test getting rate limit reset time"""
        client_id = "test-client"
        
        # Make a request
        limiter.check_rate_limit(client_id)
        
        reset_time = limiter.get_reset_time(client_id)
        assert reset_time is not None
        assert reset_time >= 60


class TestMessageQueue:
    """Test MessageQueue functionality"""
    
    @pytest.fixture
    def queue(self):
        return MessageQueue(max_size=100)
    
    def test_add_message(self, queue):
        """Test adding messages to queue"""
        client_id = "test-client"
        message = {"type": "test", "data": {}}
        
        queue.add_message(client_id, message)
        assert queue.get_queue_size(client_id) == 1
    
    def test_get_messages(self, queue):
        """Test retrieving messages from queue"""
        client_id = "test-client"
        messages = [
            {"type": "test1", "data": {}},
            {"type": "test2", "data": {}}
        ]
        
        for msg in messages:
            queue.add_message(client_id, msg)
        
        retrieved = queue.get_messages(client_id)
        assert len(retrieved) == 2
        assert retrieved == messages
        assert queue.get_queue_size(client_id) == 0
    
    def test_max_queue_size(self, queue):
        """Test queue size limit"""
        client_id = "test-client"
        
        # Fill queue beyond max size
        for i in range(150):
            queue.add_message(client_id, {"type": f"test{i}", "data": {}})
        
        # Should only keep max_size messages
        assert queue.get_queue_size(client_id) == 100
        
        # Oldest messages should be dropped
        messages = queue.get_messages(client_id)
        assert messages[0]["type"] == "test50"
    
    def test_clear_client_queue(self, queue):
        """Test clearing client queue"""
        client_id = "test-client"
        
        queue.add_message(client_id, {"type": "test", "data": {}})
        queue.clear_client_queue(client_id)
        
        assert queue.get_queue_size(client_id) == 0


@pytest.mark.asyncio
class TestWebSocketEndpoint:
    """Test WebSocket endpoint integration"""
    
    @pytest.fixture
    def app(self):
        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(websocket_router)
        return app
    
    @pytest.fixture
    def client(self, app):
        return TestClient(app)
    
    async def test_websocket_connection(self, client):
        """Test establishing WebSocket connection"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Should receive handshake
            data = websocket.receive_json()
            assert data["type"] == "connection.established"
            assert data["data"]["sessionId"] == "test-client"
    
    async def test_websocket_echo(self, client):
        """Test WebSocket echo functionality"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send message
            test_message = {"type": "echo", "data": {"value": "test"}}
            websocket.send_json(test_message)
            
            # Should receive echo
            response = websocket.receive_json()
            assert response == test_message
    
    async def test_websocket_request_response(self, client):
        """Test request/response pattern"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send request with correlation ID
            request = {
                "type": "request",
                "correlationId": "test-123",
                "data": {"action": "get_status"}
            }
            websocket.send_json(request)
            
            # Should receive response with same correlation ID
            response = websocket.receive_json()
            assert response["type"] == "response"
            assert response["correlationId"] == "test-123"
    
    async def test_websocket_rate_limiting(self, client):
        """Test WebSocket rate limiting"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send many messages quickly
            for i in range(105):
                websocket.send_json({"type": "test", "data": {"i": i}})
            
            # Should receive rate limit error
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert response["error"] == "rate_limit_exceeded"
    
    async def test_websocket_binary_data(self, client):
        """Test WebSocket binary data handling"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send binary data
            binary_data = b"test binary data"
            websocket.send_bytes(binary_data)
            
            # Should handle binary data without error
            # (In real implementation, this would trigger file upload logic)
    
    async def test_websocket_error_handling(self, client):
        """Test WebSocket error handling"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send malformed JSON
            websocket.send_text("invalid json {")
            
            # Should receive error response
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "parse" in response["error"].lower()
    
    async def test_websocket_heartbeat(self, client):
        """Test WebSocket heartbeat/ping-pong"""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Skip handshake
            websocket.receive_json()
            
            # Send ping
            websocket.send_json({"type": "ping"})
            
            # Should receive pong
            response = websocket.receive_json()
            assert response["type"] == "pong"


class TestWebSocketIntegration:
    """Test WebSocket integration with backend services"""
    
    @pytest.mark.asyncio
    async def test_file_upload_over_websocket(self):
        """Test file upload through WebSocket"""
        manager = ConnectionManager()
        client_id = "test-client"
        
        # Mock WebSocket
        ws = AsyncMock()
        await manager.connect(client_id, ws)
        
        # Simulate file upload start
        upload_start = {
            "type": "upload.start",
            "data": {
                "fileId": "test-file",
                "fileName": "test.json",
                "fileSize": 1024,
                "totalChunks": 2
            }
        }
        
        # Process upload start
        # (In real implementation, this would initialize upload tracking)
        
        # Simulate chunk uploads
        chunks = [
            {"type": "upload.chunk", "data": {"fileId": "test-file", "chunkIndex": 0}},
            {"type": "upload.chunk", "data": {"fileId": "test-file", "chunkIndex": 1}}
        ]
        
        # Should track upload progress
        # Should send progress updates
        # Should finalize upload when all chunks received
    
    @pytest.mark.asyncio
    async def test_state_synchronization(self):
        """Test state synchronization through WebSocket"""
        manager = ConnectionManager()
        broadcaster = EventBroadcaster(manager)
        
        # Connect multiple clients
        clients = []
        for i in range(3):
            client_id = f"client-{i}"
            ws = AsyncMock()
            await manager.connect(client_id, ws)
            await manager.join_room(client_id, "sync-room")
            clients.append((client_id, ws))
        
        # Simulate state change
        state_patch = {
            "path": "/findings/0",
            "op": "replace",
            "value": {"id": "1", "title": "Updated Finding"}
        }
        
        # Broadcast state patch
        await manager.broadcast_to_room("sync-room", {
            "type": "state.patch",
            "data": state_patch
        })
        
        # All clients should receive the patch
        for _, ws in clients:
            ws.send_text.assert_called()


class TestWebSocketPerformance:
    """Test WebSocket performance characteristics"""
    
    @pytest.mark.asyncio
    async def test_concurrent_connections(self):
        """Test handling many concurrent connections"""
        manager = ConnectionManager()
        
        # Connect many clients
        tasks = []
        for i in range(100):
            client_id = f"client-{i}"
            ws = AsyncMock()
            task = manager.connect(client_id, ws)
            tasks.append(task)
        
        # All connections should succeed
        await asyncio.gather(*tasks)
        assert len(manager.active_connections) == 100
    
    @pytest.mark.asyncio
    async def test_message_throughput(self):
        """Test message throughput"""
        manager = ConnectionManager()
        client_id = "test-client"
        ws = AsyncMock()
        await manager.connect(client_id, ws)
        
        # Send many messages
        start_time = asyncio.get_event_loop().time()
        messages_sent = 0
        
        for i in range(1000):
            await manager.send_personal_message(client_id, {
                "type": "test",
                "data": {"index": i}
            })
            messages_sent += 1
        
        duration = asyncio.get_event_loop().time() - start_time
        throughput = messages_sent / duration
        
        # Should handle at least 1000 messages per second
        assert throughput > 1000
    
    @pytest.mark.asyncio
    async def test_broadcast_performance(self):
        """Test broadcast performance to many clients"""
        manager = ConnectionManager()
        
        # Connect many clients to same room
        clients = []
        for i in range(50):
            client_id = f"client-{i}"
            ws = AsyncMock()
            await manager.connect(client_id, ws)
            await manager.join_room(client_id, "broadcast-room")
            clients.append(ws)
        
        # Broadcast message
        start_time = asyncio.get_event_loop().time()
        await manager.broadcast_to_room("broadcast-room", {
            "type": "broadcast.test",
            "data": {"timestamp": datetime.now().isoformat()}
        })
        duration = asyncio.get_event_loop().time() - start_time
        
        # Should broadcast to all clients quickly
        assert duration < 0.1  # Less than 100ms
        
        # All clients should receive the message
        for ws in clients:
            ws.send_text.assert_called_once()


# Fixtures for pytest
@pytest.fixture
def websocket_router():
    """Create WebSocket router for testing"""
    from fastapi import APIRouter
    router = APIRouter()
    router.add_api_websocket_route("/ws/{client_id}", websocket_endpoint)
    return router


# Helper functions for testing
async def create_test_websocket():
    """Create a test WebSocket connection"""
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    ws.send_bytes = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.receive_bytes = AsyncMock()
    return ws


async def simulate_websocket_session(client_id: str, messages: List[Dict[str, Any]]):
    """Simulate a WebSocket session with predefined messages"""
    async with websockets.connect(f"ws://localhost:8000/ws/{client_id}") as websocket:
        # Receive handshake
        handshake = await websocket.recv()
        handshake_data = json.loads(handshake)
        assert handshake_data["type"] == "connection.established"
        
        # Send and receive messages
        for message in messages:
            await websocket.send(json.dumps(message))
            response = await websocket.recv()
            yield json.loads(response)