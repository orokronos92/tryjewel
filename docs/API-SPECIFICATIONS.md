# Bijoux AI Tracking API - Specifications v2.0

## Overview
RESTful API and WebSocket service for real-time jewelry tracking using MediaPipe.

**Base URL:** `http://localhost:5000`
**Version:** 2.0
**Protocol:** HTTP / WebSocket (SocketIO)

---

## Table of Contents
1. [Authentication](#authentication)
2. [HTTP Endpoints](#http-endpoints)
   - [GET /health](#get-health)
   - [POST /api/track](#post-apitrack)
3. [WebSocket Events](#websocket-events)
   - [Connection](#connection)
   - [track_frame](#track_frame)
   - [tracking_results](#tracking_results)
   - [tracking_error](#tracking_error)
4. [Data Models](#data-models)
   - [TrackingRequest](#trackingrequest)
   - [TrackingResult](#trackingresult)
   - [JewelryPosition](#jewelryposition)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Authentication

### Current Status
No authentication required for Phase 1 (local development only).

### Future Implementation (Phase 7)
```
Authorization: Bearer <API_KEY>
```

---

## HTTP Endpoints

### GET /health
Health check endpoint for service monitoring.

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "Bijoux AI Tracking API",
  "version": "2.0",
  "mediapipe_loaded": true,
  "timestamp": 1700227200.123
}
```

**Response Fields:**
- `status`: Service status (`healthy` | `degraded` | `unhealthy`)
- `service`: Service name
- `version`: API version
- `mediapipe_loaded`: MediaPipe initialization status
- `timestamp`: Unix timestamp

**Example:**
```bash
curl http://localhost:5000/health
```

**HTTP Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service degraded/unhealthy

---

### POST /api/track
Process a single frame and return jewelry position.

**Endpoint:** `POST /api/track`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "image": {
    "image_data": "base64_encoded_image_string",
    "format": "jpeg",
    "width": 640,
    "height": 480
  },
  "jewelry_type": "ring",
  "finger": "index",
  "hand": "right",
  "request_id": "req_12345",
  "enable_caching": true
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image.image_data` | string | Yes | Base64 encoded image data |
| `image.format` | string | No | Image format: `jpeg`, `png` |
| `image.width` | integer | No | Image width in pixels |
| `image.height` | integer | No | Image height in pixels |
| `jewelry_type` | string | Yes | `ring`, `bracelet`, `earring`, `necklace` |
| `finger` | string | Conditional | Required for `ring`: `thumb`, `index`, `middle`, `ring`, `pinky` |
| `hand` | string | No | `left` or `right` (default: `right`) |
| `request_id` | string | No | Client request identifier |
| `enable_caching` | boolean | No | Enable Redis caching (default: `true`) |

**Supported Jewelry Types:**
- ✅ `ring` - Requires `finger` parameter
- ✅ `bracelet` - Uses wrist landmark
- 🔄 `earring` - Planned Phase 3
- 🔄 `necklace` - Planned Phase 3

**Response (200 OK):**
```json
{
  "success": true,
  "jewelry_type": "ring",
  "jewelry_position": {
    "position": {"x": 0.52, "y": 0.34, "z": 0.02},
    "rotation": {"x": 0, "y": 0, "z": 15},
    "scale": 0.8,
    "confidence": 0.92,
    "finger": "index",
    "hand": "right"
  },
  "hand_result": {
    "handedness": "Right",
    "handedness_score": 0.95,
    "landmarks_count": 21
  },
  "confidence": 0.92,
  "processing_time_ms": 42.5,
  "request_id": "req_12345",
  "cached": false,
  "error": null
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `jewelry_type` | string | Jewelry type processed |
| `jewelry_position` | object | 3D position, rotation, scale |
| `hand_result` | object | Hand detection data |
| `confidence` | float | Overall tracking confidence (0-1) |
| `processing_time_ms` | float | Server processing time |
| `request_id` | string | Echo of client request ID |
| `cached` | boolean | Result retrieved from cache |
| `error` | string | Error message if failed |

**JewelryPosition Object:**
```json
{
  "position": {"x": 0.52, "y": 0.34, "z": 0.02},
  "rotation": {"x": 0, "y": 0, "z": 15},
  "scale": 0.8,
  "confidence": 0.92,
  "finger": "index",
  "hand": "right"
}
```

**Coordinates System:**
- All coordinates are **normalized** (0.0 - 1.0)
- `x`: Horizontal position (0 = left, 1 = right)
- `y`: Vertical position (0 = top, 1 = bottom)
- `z`: Depth position (0 = camera plane, positive = away from camera)
- `rotation`: Euler angles in degrees (x, y, z)

**Confidence Scores:**
- `confidence`: 0.0 - 1.0 (higher is better)
- >0.7: High confidence
- 0.5-0.7: Medium confidence
- <0.5: Low confidence

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "image": {
      "image_data": "/9j/4AAQSkZJRgABAQ...",
      "format": "jpeg"
    },
    "jewelry_type": "ring",
    "finger": "index",
    "hand": "right",
    "request_id": "req_123"
  }'
```

**HTTP Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Endpoint doesn't exist
- `500 Internal Server Error`: Server error

---

## WebSocket Events

### Connection
Connect to WebSocket server for real-time tracking.

**URL:** `ws://localhost:5000/socket.io/`

**SocketIO Version:** 4.x

**Transport:** `websocket` (preferred) or `polling`

**Client Example (JavaScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  cors: {
    origin: "http://localhost:3000"
  }
});

socket.on('connect', () => {
  console.log('Connected to tracking server');
});
```

---

### track_frame
Send a video frame for real-time tracking.

**Event:** `track_frame`

**Payload:**
```json
{
  "image_base64": "base64_encoded_frame",
  "jewelry_type": "ring",
  "finger": "index",
  "hand": "right",
  "frame_id": "frame_123",
  "timestamp": 1700227200.123
}
```

**Payload Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_base64` | string | Yes | Base64 encoded frame data |
| `jewelry_type` | string | Yes | `ring` or `bracelet` |
| `finger` | string | Conditional | Required for `ring` |
| `hand` | string | No | `left` or `right` |
| `frame_id` | string | Yes | Unique frame identifier |
| `timestamp` | number | No | Client timestamp |

**Rate Limit:**
- Recommended: 10 FPS (100ms intervals)
- Maximum: 30 FPS
- Server enforces no hard limit

**Example:**
```javascript
socket.emit('track_frame', {
  image_base64: base64Frame,
  jewelry_type: 'ring',
  finger: 'index',
  hand: 'right',
  frame_id: `frame_${Date.now()}`,
  timestamp: Date.now()
});
```

---

### tracking_results
Receive tracking results from server.

**Event:** `tracking_results`

**Payload:**
```json
{
  "frame_id": "frame_123",
  "success": true,
  "cached": false,
  "jewelry_type": "ring",
  "jewelry_position": {
    "position": {"x": 0.52, "y": 0.34, "z": 0.02},
    "rotation": {"x": 0, "y": 0, "z": 15},
    "scale": 0.8,
    "confidence": 0.92
  },
  "confidence": 0.92,
  "processing_time_ms": 42.5,
  "server_timestamp": 1700227200.123
}
```

**Payload Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `frame_id` | string | Echo of client's frame_id |
| `success` | boolean | Tracking success status |
| `cached` | boolean | True if retrieved from Redis cache |
| `jewelry_type` | string | Jewelry type |
| `jewelry_position` | object | 3D position data |
| `confidence` | float | Tracking confidence (0-1) |
| `processing_time_ms` | float | Server processing time |
| `server_timestamp` | number | Server processing timestamp |

**Client Example:**
```javascript
socket.on('tracking_results', (result) => {
  if (result.success) {
    // Update 3D model position
    updateJewelryModel(
      result.jewelry_position.position,
      result.jewelry_position.rotation,
      result.jewelry_position.scale
    );

    // Log latency
    const latency = Date.now() - result.server_timestamp;
    console.log(`Frame ${result.frame_id}: ${latency}ms`);
  }
});
```

---

### tracking_error
Receive error response for failed tracking.

**Event:** `tracking_error`

**Payload:**
```json
{
  "frame_id": "frame_123",
  "success": false,
  "error": "No hand detected in frame",
  "error_code": "NO_HAND_DETECTED"
}
```

**Error Codes:**

| Code | Description |
|------|-------------|
| `NO_HAND_DETECTED` | No hand found in frame |
| `HAND_NOT_FOUND` | Target hand not detected |
| `VALIDATION_ERROR` | Invalid request data |
| `TRACKING_FAILED` | General tracking failure |
| `INTERNAL_ERROR` | Server internal error |

**Client Example:**
```javascript
socket.on('tracking_error', (error) => {
  console.error(`Frame ${error.frame_id} failed: ${error.error}`);

  // Update UI to show error
  showTrackingError(error.error);
});
```

---

### Connection Events

#### connect
Triggered when client successfully connects.

```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

#### disconnect
Triggered when client disconnects.

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### connection_error
Triggered on connection failure.

```javascript
socket.on('connection_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

#### connection_response
Server response after successful connection.

```javascript
socket.on('connection_response', (response) => {
  console.log('Server response:', response.status);
});
```

---

## Data Models

### TrackingRequest
```typescript
interface TrackingRequest {
  image: {
    image_data: string;      // Base64 encoded
    format?: string;         // "jpeg" | "png"
    width?: number;
    height?: number;
  };
  jewelry_type: "ring" | "bracelet" | "earring" | "necklace";
  finger?: "thumb" | "index" | "middle" | "ring" | "pinky";
  hand?: "left" | "right";
  request_id?: string;
  enable_caching?: boolean;
}
```

### TrackingResult
```typescript
interface TrackingResult {
  success: boolean;
  jewelry_type: string;
  jewelry_position: JewelryPosition;
  hand_result: HandResult;
  confidence: number;        // 0.0 - 1.0
  processing_time_ms: number;
  request_id?: string;
  cached?: boolean;
  error?: string;
}
```

### JewelryPosition
```typescript
interface JewelryPosition {
  position: {
    x: number;  // 0.0 - 1.0 (normalized)
    y: number;  // 0.0 - 1.0
    z: number;  // depth
  };
  rotation: {
    x: number;  // degrees
    y: number;  // degrees
    z: number;  // degrees
  };
  scale: number;      // 0.5 - 2.0
  confidence: number; // 0.0 - 1.0
  finger?: string;
  hand?: string;
}
```

### HandResult
```typescript
interface HandResult {
  handedness: "Left" | "Right";
  handedness_score: number;  // 0.0 - 1.0
  landmarks_count: number;    // 21 for MediaPipe
}
```

---

## Error Handling

### HTTP Errors
```json
{
  "success": false,
  "error": "No hand detected in frame",
  "error_code": "NO_HAND_DETECTED"
}
```

### WebSocket Errors
```json
{
  "frame_id": "frame_123",
  "success": false,
  "error": "No hand detected in frame",
  "error_code": "NO_HAND_DETECTED"
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Invalid request format
- `NO_HAND_DETECTED` - No hands in frame
- `HAND_NOT_FOUND` - Selected hand not detected
- `UNSUPPORTED_JEWELRY` - Jewelry type not supported
- `TRACKING_FAILED` - General tracking failure
- `INTERNAL_ERROR` - Server error
- `CACHE_ERROR` - Redis cache failure

---

## Rate Limiting

### Current Status
No rate limiting in Phase 1 (local development).

### Recommended Limits (Future)
- **HTTP API:** 60 requests per minute
- **WebSocket:** 30 FPS maximum
- **Burst Limit:** 5 requests per second

---

## Caching

### Redis Cache
- **TTL:** 100ms per frame hash
- **Key Format:** `bijoux:landmarks:<frame_hash>`
- **Hit Rate Target:** >60%

**Cache Behavior:**
- Frame hash calculated from base64 image data
- Cached results include: position, rotation, scale, confidence
- Cache checked before processing
- Successful results cached automatically

**Disable Cache:**
```json
{
  "enable_caching": false
}
```

---

## Performance Targets

### Latency
- **Average:** <50ms per frame
- **P95:** <60ms
- **P99:** <80ms

### Throughput
- **WebSocket:** 10 FPS stable
- **HTTP API:** 20 requests/second

### Precision
- **Hand Detection:** >90%
- **Landmark Stability:** <5% jitter

---

## Examples

### Complete HTTP Example
```python
import requests
import base64

# Read and encode image
with open('hand.jpg', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode()

# Send request
response = requests.post(
    'http://localhost:5000/api/track',
    json={
        'image': {'image_data': image_data},
        'jewelry_type': 'ring',
        'finger': 'index',
        'hand': 'right'
    }
)

result = response.json()
if result['success']:
    position = result['jewelry_position']['position']
    print(f"Ring position: {position}")
```

### Complete WebSocket Example
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('tracking_results', (result) => {
  if (result.success) {
    const { position, rotation, scale } = result.jewelry_position;
    update3DModel(position, rotation, scale);
  }
});

socket.on('tracking_error', (error) => {
  console.error('Tracking failed:', error.error);
});

// Send a frame
function sendFrame(base64Image) {
  socket.emit('track_frame', {
    image_base64: base64Image,
    jewelry_type: 'ring',
    finger: 'index',
    hand: 'right',
    frame_id: `frame_${Date.now()}`,
    timestamp: Date.now()
  });
}
```

---

## Version History

### v2.0 (Current)
- ✅ WebSocket real-time tracking
- ✅ 100ms Redis caching
- ✅ Finger selection (5 fingers × 2 hands)
- ✅ Bracelet tracking
- ✅ Performance monitoring

### v1.0 (Deprecated)
- Basic hand detection
- No finger selection
- No caching
- Lower precision

---

## Support

**Documentation:** [docs/API-SPECIFICATIONS.md](API-SPECIFICATIONS.md)
**Issues:** Report on GitHub
**Email:** support@bijouxai.com (future)

---

*Last Updated: 17 November 2025*
*API Version: 2.0*
*Backend Version: Phase 1 Complete*
