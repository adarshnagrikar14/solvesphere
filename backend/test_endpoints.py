"""
Test script for Ultravox Backend API endpoints
Run this after starting the server to test all endpoints
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_response(response, title):
    """Pretty print API response."""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response:\n{json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")
    print()

def test_health_check():
    """Test the health check endpoint."""
    print("\n\n🏥 Testing Health Check...")
    response = requests.get(f"{BASE_URL}/")
    print_response(response, "Health Check")
    return response.status_code == 200

def test_create_call():
    """Test creating a new Ultravox call."""
    print("\n\n📞 Testing Create Call...")
    payload = {
        "metadata": {
            "customer_id": "TEST123",
            "session_type": "support",
            "test": "true"
        },
        "recording_enabled": True,
        "first_speaker_prompt": "(New Call) Respond as if you are answering the phone."
    }

    response = requests.post(f"{BASE_URL}/api/calls", json=payload)
    print_response(response, "Create Call")

    if response.status_code == 201:
        return response.json().get("call_id")
    return None

def test_list_calls():
    """Test listing all calls."""
    print("\n\n📋 Testing List Calls...")
    response = requests.get(f"{BASE_URL}/api/calls")
    print_response(response, "List All Calls")

def test_get_call(call_id):
    """Test getting a specific call."""
    if not call_id:
        print("\n⚠️  Skipping Get Call test (no call_id)")
        return

    print(f"\n\n🔍 Testing Get Call Details for {call_id}...")
    response = requests.get(f"{BASE_URL}/api/calls/{call_id}")
    print_response(response, f"Get Call Details: {call_id}")

def test_escalate_to_human(call_id):
    """Test the escalate_to_human tool endpoint."""
    if not call_id:
        print("\n⚠️  Skipping Escalate test (no call_id)")
        return

    print(f"\n\n🚨 Testing Escalate to Human for {call_id}...")
    payload = {
        "call_id": call_id,
        "escalation_reason": "Customer needs advanced technical support - test escalation",
        "priority_level": "high",
        "context_summary": "Test call - customer laptop won't boot after software update",
        "customer_sentiment": "frustrated"
    }

    response = requests.post(f"{BASE_URL}/api/tools/escalate_to_human", json=payload)
    print_response(response, "Escalate to Human")

def test_log_engagement(call_id):
    """Test the log_call_engagement tool endpoint."""
    if not call_id:
        print("\n⚠️  Skipping Log Engagement test (no call_id)")
        return

    print(f"\n\n📊 Testing Log Call Engagement for {call_id}...")
    payload = {
        "call_id": call_id,
        "call_phase": "closing_conversation",
        "customer_sentiment": "satisfied",
        "resolution_likelihood": 85,
        "issue_resolved": True,
        "engagement_notes": "Test call - successfully logged engagement metrics"
    }

    response = requests.post(f"{BASE_URL}/api/tools/log_call_engagement", json=payload)
    print_response(response, "Log Call Engagement")

def test_webhook_simulation(call_id):
    """Simulate a webhook event (for testing purposes)."""
    if not call_id:
        print("\n⚠️  Skipping Webhook test (no call_id)")
        return

    print(f"\n\n🪝 Testing Webhook Endpoint (simulated) for {call_id}...")

    # Simulate a call.ended webhook
    payload = {
        "event": "call.ended",
        "call": {
            "callId": call_id,
            "endReason": "hangup",
            "shortSummary": "Test call ended successfully",
            "summary": "This is a test webhook simulation. The call was created for testing purposes and ended normally.",
            "ended": "2026-01-19T15:00:00Z"
        }
    }

    response = requests.post(f"{BASE_URL}/api/webhook", json=payload)
    print_response(response, "Webhook (Simulated)")

def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("🚀 Starting Ultravox Backend API Tests")
    print("="*60)

    # Test health check
    if not test_health_check():
        print("\n❌ Server is not responding! Make sure the server is running.")
        print("   Start the server with: python backend/main.py")
        return

    print("\n✅ Server is running!")

    # Create a test call
    call_id = test_create_call()

    if call_id:
        print(f"\n✅ Call created successfully! Call ID: {call_id}")

        # Give the call a moment to be created
        time.sleep(1)

        # Test other endpoints with this call_id
        test_escalate_to_human(call_id)
        test_log_engagement(call_id)
        test_webhook_simulation(call_id)

        # Get call details to see all the data
        test_get_call(call_id)
    else:
        print("\n❌ Failed to create call. Check your Ultravox API configuration in .env")
        print("   Make sure ULTRAVOX_API_KEY and ULTRAVOX_AGENT_ID are set correctly.")

    # List all calls
    test_list_calls()

    print("\n" + "="*60)
    print("🎉 Tests Complete!")
    print("="*60)
    print("\nNext steps:")
    print("  1. Check the database: backend/ultravox.db")
    print("  2. Visit the API docs: http://localhost:8000/docs")
    print("  3. Use the Swagger UI to test endpoints interactively")
    print("="*60)

if __name__ == "__main__":
    main()
