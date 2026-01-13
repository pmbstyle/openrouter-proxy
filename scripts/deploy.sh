#!/bin/bash
set -e

echo "🚀 Deploying LLM Proxy Service to Production"

# Load environment variables
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
else
  echo "❌ .env.production not found"
  echo "Creating .env.production from .env.production.example..."
  cp .env.production.example .env.production
  echo "✅ Created .env.production"
  echo "⚠️  Please edit .env.production with your production values and run this script again."
  exit 1
fi

# Validate required variables
required_vars=("OPENROUTER_API_KEY" "API_KEYS" "ALLOWED_ORIGINS")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Required variable $var is not set in .env.production"
    exit 1
  fi
done

# Check if .env.production.example variable is still set
if [[ "$OPENROUTER_API_KEY" == "your_openrouter_api_key_here" ]]; then
  echo "❌ OPENROUTER_API_KEY is not set correctly in .env.production"
  exit 1
fi

echo "✅ Configuration validated"

# Build Docker image
echo "📦 Building Docker image..."
docker build -f docker/Dockerfile -t llm-proxy:latest .

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker/docker-compose.yml down

# Create SSL directory if it doesn't exist
if [ ! -d docker/ssl ]; then
  echo "🔒 Creating SSL directory..."
  mkdir -p docker/ssl
  echo "⚠️  Please place your SSL certificates in docker/ssl/"
  echo "   - docker/ssl/cert.pem"
  echo "   - docker/ssl/key.pem"
  echo "   For development, you can generate self-signed certs:"
  echo "   openssl req -x509 -newkey rsa:4096 -keyout docker/ssl/key.pem -out docker/ssl/cert.pem -days 365 -nodes"
fi

# Start new containers
echo "▶️  Starting containers..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for health check
echo "⏳ Waiting for service to be healthy..."
timeout 60 bash -c 'until docker-compose -f docker/docker-compose.yml exec -T llm-proxy node -e "require(\"http\").get(\"http://localhost:3000/health\", (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"; do sleep 2; done'

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  echo ""
  echo "📊 Service endpoints:"
  echo "   - HTTP API: http://localhost:3000/api/v1"
  echo "   - WebSocket: ws://localhost:3000/ws"
  echo "   - Health: http://localhost:3000/health"
  echo "   - Prometheus: http://localhost:9090"
  echo "   - Grafana: http://localhost:3001 (default password: admin)"
  echo ""
  echo "📈 To view logs:"
  echo "   docker-compose -f docker/docker-compose.yml logs -f"
  echo ""
  echo "🛑 To stop:"
  echo "   docker-compose -f docker/docker-compose.yml down"
else
  echo "❌ Health check failed"
  echo "Check logs with: docker-compose -f docker/docker-compose.yml logs"
  exit 1
fi
