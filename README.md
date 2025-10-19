# LLM Proxy Service

A high-performance, stateless OpenRouter proxy service built with Node.js, TypeScript, and Express. Provides REST API and WebSocket streaming capabilities for LLM inference without authentication or user tracking.

## Features

- **Stateless Design**: No authentication or user tracking - direct access to OpenRouter API
- **Dual Interface**: REST API for standard requests and WebSocket for streaming
- **Comprehensive Parameter Support**: System prompts, model/provider selection, temperature, tools, etc.
- **Multi-modal Support**: Text, audio, and image generation capabilities
- **Robust Error Handling**: Graceful failure recovery and informative error responses
- **High Performance**: Optimized for speed and low latency
- **IP-based Rate Limiting**: Protection against abuse while maintaining simplicity

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd llm-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your OpenRouter API key
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Configuration

The service uses environment variables for configuration. See `.env.example` for all available options:

### Required Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key

### Optional Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (development/production/test)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 900000)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
- `WS_MAX_CONNECTIONS`: Max WebSocket connections (default: 1000)
- `WS_HEARTBEAT_INTERVAL`: WebSocket heartbeat interval (default: 30000)
- `MAX_CONCURRENT_REQUESTS`: Max concurrent requests (default: 100)
- `REQUEST_TIMEOUT`: Request timeout in milliseconds (default: 30000)

## API Endpoints

### Health Check

#### `GET /health`
Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0",
  "environment": "production"
}
```

### Inference Endpoints

#### `POST /api/v1/inference`
Create a completion using the specified model.

**Request Body:**
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello, world!"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123",
  "choices": [
    {
      "finish_reason": "stop",
      "message": {
        "content": "Hello! How can I help you today?",
        "role": "assistant"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "model": "openai/gpt-4o",
  "created": 1704067200,
  "object": "chat.completion"
}
```

#### `POST /api/v1/inference/stream`
Create a streaming completion using the specified model.

**Request Body:**
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Tell me a story"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500,
  "stream": true
}
```

**Response:** Server-Sent Events stream
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704067200,"model":"openai/gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704067200,"model":"openai/gpt-4o","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704067200,"model":"openai/gpt-4o","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}

data: [DONE]
```

### Model Endpoints

#### `GET /api/v1/models`
List all available models with optional filtering and pagination.

**Query Parameters:**
- `provider` (optional): Filter by provider (e.g., "openai", "anthropic")
- `search` (optional): Search in model name or description
- `limit` (optional): Number of models to return (default: 50, max: 100)
- `offset` (optional): Number of models to skip (default: 0)

**Example:**
```
GET /api/v1/models?provider=openai&search=gpt&limit=10&offset=0
```

**Response:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "description": "Most advanced GPT-4 model",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.005",
        "completion": "0.015"
      },
      "supported_parameters": ["temperature", "max_tokens", "top_p"],
      "is_moderated": true,
      "max_completion_tokens": 4096
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### `GET /api/v1/models/:id`
Get detailed information about a specific model.

**Example:**
```
GET /api/v1/models/openai/gpt-4o
```

**Response:**
```json
{
  "data": {
    "id": "openai/gpt-4o",
    "name": "GPT-4o",
    "description": "Most advanced GPT-4 model",
    "context_length": 128000,
    "pricing": {
      "prompt": "0.005",
      "completion": "0.015"
    },
    "supported_parameters": ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"],
    "is_moderated": true,
    "max_completion_tokens": 4096
  }
}
```

#### `GET /api/v1/models/:id/parameters`
Get supported parameters for a specific model.

**Example:**
```
GET /api/v1/models/openai/gpt-4o/parameters
```

**Response:**
```json
{
  "data": {
    "model": "openai/gpt-4o",
    "supported_parameters": [
      "temperature",
      "max_tokens",
      "top_p",
      "frequency_penalty",
      "presence_penalty",
      "stop",
      "stream"
    ]
  }
}
```

#### `GET /api/v1/models/:id/pricing`
Get pricing information for a specific model.

**Example:**
```
GET /api/v1/models/openai/gpt-4o/pricing
```

**Response:**
```json
{
  "data": {
    "model": "openai/gpt-4o",
    "pricing": {
      "prompt": "0.005",
      "completion": "0.015"
    }
  }
}
```

#### `GET /api/v1/models/top`
Get top models by context length.

**Query Parameters:**
- `limit` (optional): Number of models to return (default: 10)

**Example:**
```
GET /api/v1/models/top?limit=5
```

**Response:**
```json
{
  "data": [
    {
      "id": "anthropic/claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "context_length": 200000,
      "pricing": {
        "prompt": "0.003",
        "completion": "0.015"
      }
    }
  ]
}
```

#### `GET /api/v1/models/search`
Search models by query.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results to return (default: 20)

**Example:**
```
GET /api/v1/models/search?q=code&limit=5
```

**Response:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "description": "Most advanced GPT-4 model with code capabilities"
    }
  ],
  "query": "code",
  "total": 25
}
```

#### `GET /api/v1/models/providers`
Get all available providers.

**Response:**
```json
{
  "data": [
    "openai",
    "anthropic",
    "google",
    "meta",
    "mistral"
  ]
}
```

#### `GET /api/v1/models/providers/:provider`
Get models by provider.

**Example:**
```
GET /api/v1/models/providers/openai
```

**Response:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "context_length": 128000
    }
  ],
  "provider": "openai"
}
```

## WebSocket API

### Connection

Connect to the WebSocket endpoint:
```
ws://localhost:3000/ws
```

### Message Types

#### Inference Request
```json
{
  "type": "inference_request",
  "id": "req-123",
  "data": {
    "model": "openai/gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Hello, world!"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }
}
```

#### Inference Response
```json
{
  "type": "inference_response",
  "id": "req-123",
  "data": {
    "content": "Hello! How can I help you today?",
    "finish_reason": "stop",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 15,
      "total_tokens": 25
    },
    "model": "openai/gpt-4o",
    "created": 1704067200
  }
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": 1704067200000
}
```

#### Error
```json
{
  "type": "error",
  "id": "req-123",
  "error": {
    "code": 400,
    "message": "Invalid model",
    "type": "validation"
  }
}
```

#### Close
```json
{
  "type": "close",
  "reason": "Client requested close",
  "code": 1000
}
```

## Usage Examples

### REST API Example (JavaScript)

```javascript
// Standard completion
const response = await fetch('http://localhost:3000/api/v1/inference', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'user', content: 'Hello, world!' }
    ],
    temperature: 0.7,
    max_tokens: 100
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Streaming Example (JavaScript)

```javascript
// Streaming completion
const response = await fetch('http://localhost:3000/api/v1/inference/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'user', content: 'Tell me a story' }
    ],
    temperature: 0.7,
    max_tokens: 500,
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.choices?.[0]?.delta?.content) {
          console.log(parsed.choices[0].delta.content);
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }
}
```

### WebSocket Example (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Send inference request
  ws.send(JSON.stringify({
    type: 'inference_request',
    id: 'req-123',
    data: {
      model: 'openai/gpt-4o',
      messages: [
        { role: 'user', content: 'Hello, world!' }
      ],
      temperature: 0.7
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'inference_response':
      if (message.data.content) {
        console.log(message.data.content);
      }
      if (message.data.finish_reason) {
        console.log('Finished:', message.data.finish_reason);
      }
      break;
      
    case 'error':
      console.error('Error:', message.error.message);
      break;
      
    case 'heartbeat':
      console.log('Heartbeat received');
      break;
  }
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
};
```

### Python Example

```python
import requests
import json

# Standard completion
response = requests.post('http://localhost:3000/api/v1/inference', 
    json={
        'model': 'openai/gpt-4o',
        'messages': [
            {'role': 'user', 'content': 'Hello, world!'}
        ],
        'temperature': 0.7,
        'max_tokens': 100
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

### cURL Examples

```bash
# Standard completion
curl -X POST http://localhost:3000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'

# List models
curl http://localhost:3000/api/v1/models

# Get model details
curl http://localhost:3000/api/v1/models/openai/gpt-4o

# Search models
curl "http://localhost:3000/api/v1/models/search?q=gpt&limit=5"
```

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": {
    "code": 400,
    "message": "Validation error",
    "type": "validation",
    "details": {
      "field": "model",
      "message": "Model is required"
    }
  }
}
```

### Error Types

- `validation`: Request validation failed
- `rate_limit`: Rate limit exceeded
- `openrouter`: OpenRouter API error
- `internal`: Internal server error

### Common Error Codes

- `400`: Bad Request - Invalid request data
- `404`: Not Found - Model or endpoint not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error
- `502`: Bad Gateway - OpenRouter API error
- `503`: Service Unavailable - Service temporarily unavailable

## Rate Limiting

The service implements IP-based rate limiting:

- **Default**: 100 requests per 15 minutes per IP
- **Inference endpoints**: 50 requests per 15 minutes per IP
- **WebSocket**: 5 connections per minute per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

### Project Structure

```
src/
├── controllers/          # Request handlers
├── services/            # Business logic
├── middleware/          # Express middleware
├── routes/              # API routes
├── types/               # TypeScript definitions
├── utils/               # Utility functions
├── app.ts               # Express app setup
└── server.ts            # Server entry point
```

## Testing

The project includes comprehensive tests:

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test complete request/response cycles
- **Load tests**: Test performance under load

Run tests:
```bash
npm test
```

## Docker

### Build and Run

```bash
# Build the image
docker build -f docker/Dockerfile -t llm-proxy .

# Run the container
docker run -p 3000:3000 -e OPENROUTER_API_KEY=your-key llm-proxy
```

### Docker Compose

```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Stop all services
docker-compose -f docker/docker-compose.yml down
```

## Monitoring

The service provides monitoring endpoints:

- `GET /health` - Health check with uptime and version info

## Security

- IP-based rate limiting
- Input validation and sanitization
- CORS protection
- Security headers (Helmet)
- No authentication required (stateless design)

## Performance

- Connection pooling for OpenRouter API
- Efficient WebSocket handling
- Memory-optimized streaming
- Request/response compression
- Caching for model information
- Stateless design for horizontal scaling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please open an issue on GitHub.