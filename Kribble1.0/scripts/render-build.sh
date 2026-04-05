#!/bin/bash
set -e

echo "=== Starting Render Build ==="

# Install root dependencies
echo "Installing root dependencies..."
npm install --include=dev

# Build shared package first (with its own dependencies)
echo "Building shared package..."
cd shared
npm install
npm run build
cd ..

# Build all workspaces
echo "Building all workspaces..."
npm run build --workspaces

# Build server specifically
echo "Building server..."
cd server
npm run build
cd ..

echo "=== Build Complete ==="
