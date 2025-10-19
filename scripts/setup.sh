#!/bin/bash

# Setup script for LLM Proxy Service
set -e

echo "🚀 Setting up LLM Proxy Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your OpenRouter API key"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your OpenRouter API key"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Run 'npm test' to run tests"
echo ""
echo "Available commands:"
echo "  npm run dev     - Start development server"
echo "  npm start       - Start production server"
echo "  npm test        - Run tests"
echo "  npm run build   - Build the project"
echo "  npm run lint    - Run linter"
