#!/bin/bash

# Phase 3 Live Endpoint Testing
# Tests deployed dashboard-service endpoints

DASHBOARD_URL="https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run"

echo "🧪 Phase 3: Live Endpoint Testing"
echo "=================================="
echo ""

# Note: These endpoints require authentication
# We'll test without auth first to verify they're responding

echo "📍 Testing dashboard-service deployment..."
echo "   URL: $DASHBOARD_URL"
echo ""

# Test 1: Health check (if available)
echo "Test 1: Service Health Check"
echo "----------------------------"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "$DASHBOARD_URL/" \
  -H "Accept: application/json" \
  2>/dev/null || echo "Service may require authentication"
echo ""
echo ""

# Test 2: /dashboard/news endpoint (should return 401 without auth)
echo "Test 2: GET /dashboard/news"
echo "----------------------------"
echo "Expected: 401 Unauthorized (endpoint exists, requires auth)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "$DASHBOARD_URL/dashboard/news?limit=3" \
  -H "Accept: application/json" \
  2>/dev/null | jq -C '.' || cat
echo ""
echo ""

# Test 3: /dashboard/bills endpoint (should return 401 without auth)
echo "Test 3: GET /dashboard/bills"
echo "----------------------------"
echo "Expected: 401 Unauthorized (endpoint exists, requires auth)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "$DASHBOARD_URL/dashboard/bills?limit=3" \
  -H "Accept: application/json" \
  2>/dev/null | jq -C '.' || cat
echo ""
echo ""

# Test 4: /bills/:id endpoint (should return 401 without auth)
echo "Test 4: GET /bills/:id"
echo "----------------------------"
echo "Expected: 401 Unauthorized (endpoint exists, requires auth)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "$DASHBOARD_URL/bills/test-bill-id" \
  -H "Accept: application/json" \
  2>/dev/null | jq -C '.' || cat
echo ""
echo ""

echo "📊 Test Summary"
echo "==============="
echo ""
echo "✅ If you see HTTP 401 responses, the endpoints are deployed and working!"
echo "   (401 = Unauthorized, which means endpoints exist but need authentication)"
echo ""
echo "❌ If you see HTTP 404 responses, the endpoints weren't deployed correctly."
echo ""
echo "🔐 To test with real data, you need an auth token:"
echo "   1. Login through the auth-service to get a JWT token"
echo "   2. Add header: -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "Example authenticated request:"
echo "  curl -H 'Authorization: Bearer eyJ...' \\"
echo "    $DASHBOARD_URL/dashboard/news?limit=5"
echo ""
