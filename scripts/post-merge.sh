#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Pushing database schema..."
npm run db:push -- --force

echo "=== Post-merge setup complete ==="
