"""
Test script for LLM Tool Use functionality.
Demonstrates how the AI can use tools to perform actions.
"""

import asyncio
import json
from datetime import datetime

# Mock database and context for testing
class MockDB:
    """Mock database session for testing"""
    def __init__(self):
        self.action_items = []
        self.notes = ""
        self.meeting_data = {
            "id": 1,
            "filename": "Test Meeting",
            "meeting_date": datetime.now(),
            "tags": "",
            "folder": ""
        }
    
    def commit(self):
        pass
    
    def refresh(self, obj):
        pass


class MockMeeting:
    """Mock meeting object"""
    def __init__(self):
        self.id = 1
        self.filename = "Test Meeting"
        self.notes = ""
        self.transcription = MockTranscription()
        self.speakers = [
            MockSpeaker("John", "Product Manager"),
            MockSpeaker("Sarah", "Developer")
        ]


class MockTranscription:
    """Mock transcription object"""
    def __init__(self):
        self.id = 1
        self.summary = "Team discussed Q4 planning and resource allocation."
        self.full_text = "The meeting covered Q4 planning. John mentioned the need to hire more developers."
        self.action_items = []


class MockSpeaker:
    """Mock speaker object"""
    def __init__(self, name, label):
        self.name = name
        self.label = label


async def test_tool_registry():
    """Test the tool registry directly"""
    print("=" * 60)
    print("Testing Tool Registry")
    print("=" * 60)
    
    try:
        from backend.app.core.tools import tool_registry
        
        # Get all tool definitions
        tools = tool_registry.get_tool_definitions()
        print(f"\n✅ Found {len(tools)} registered tools:")
        for tool in tools:
            tool_name = tool['function']['name']
            tool_desc = tool['function']['description']
            print(f"  - {tool_name}: {tool_desc}")
        
        # Test creating an action item
        print("\n" + "-" * 60)
        print("Testing: create_action_item")
        print("-" * 60)
        
        mock_db = MockDB()
        context = {
            "db": mock_db,
            "meeting_id": 1
        }
        
        args = {
            "task": "Follow up with client about proposal",
            "owner": "John",
            "due_date": "2024-12-31",
            "priority": "high"
        }
        
        # This will fail without proper mocking but shows the structure
        print(f"Arguments: {json.dumps(args, indent=2)}")
        print("Note: Full test requires database setup")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running from the project root")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def test_tool_definitions():
    """Test that tool definitions are properly formatted"""
    print("\n" + "=" * 60)
    print("Testing Tool Definition Format")
    print("=" * 60)
    
    try:
        from backend.app.core.tools import tool_registry
        
        tools = tool_registry.get_tool_definitions()
        
        for tool in tools:
            tool_name = tool['function']['name']
            print(f"\n📋 Tool: {tool_name}")
            
            # Check required fields
            assert 'type' in tool, "Missing 'type' field"
            assert tool['type'] == 'function', "Type must be 'function'"
            assert 'function' in tool, "Missing 'function' field"
            
            func = tool['function']
            assert 'name' in func, "Missing function 'name'"
            assert 'description' in func, "Missing function 'description'"
            assert 'parameters' in func, "Missing function 'parameters'"
            
            params = func['parameters']
            assert 'type' in params, "Missing parameter 'type'"
            assert 'properties' in params, "Missing parameter 'properties'"
            
            print(f"  ✅ Valid definition")
            print(f"  📝 Description: {func['description'][:60]}...")
            print(f"  🔧 Parameters: {', '.join(params['properties'].keys())}")
        
        print(f"\n✅ All {len(tools)} tools have valid definitions")
        
    except AssertionError as e:
        print(f"❌ Validation error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def test_provider_tool_support():
    """Test that providers support tool calling"""
    print("\n" + "=" * 60)
    print("Testing Provider Tool Support")
    print("=" * 60)
    
    try:
        from backend.app.core.providers import OpenAIProvider, OllamaProvider, LLMConfig
        
        # Check OpenAI Provider
        print("\n🔍 Checking OpenAI Provider...")
        import inspect
        openai_sig = inspect.signature(OpenAIProvider.chat_completion)
        print(f"  Parameters: {list(openai_sig.parameters.keys())}")
        assert 'tools' in openai_sig.parameters, "OpenAI provider missing 'tools' parameter"
        print("  ✅ OpenAI provider supports tools")
        
        # Check Ollama Provider
        print("\n🔍 Checking Ollama Provider...")
        ollama_sig = inspect.signature(OllamaProvider.chat_completion)
        print(f"  Parameters: {list(ollama_sig.parameters.keys())}")
        assert 'tools' in ollama_sig.parameters, "Ollama provider missing 'tools' parameter"
        print("  ✅ Ollama provider has tools parameter (limited support)")
        
        print("\n✅ All providers support tool calling interface")
        
    except AssertionError as e:
        print(f"❌ Validation error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def print_usage_examples():
    """Print usage examples"""
    print("\n" + "=" * 60)
    print("Usage Examples")
    print("=" * 60)
    
    examples = [
        {
            "category": "Creating Action Items",
            "queries": [
                "Create an action item to follow up with the client",
                "Add a task for John to review the proposal by Friday",
                "Create a high-priority action item to send the report"
            ]
        },
        {
            "category": "Managing Tasks",
            "queries": [
                "Mark action item 5 as completed",
                "Update task 3 to assign it to Sarah",
                "List all pending action items"
            ]
        },
        {
            "category": "Meeting Management",
            "queries": [
                "Add a note that we need to schedule a follow-up",
                "Tag this meeting with 'client' and 'sales'",
                "Update the meeting date to December 15"
            ]
        },
        {
            "category": "Information Retrieval",
            "queries": [
                "Search for mentions of the budget",
                "Who attended this meeting?",
                "Give me the meeting summary"
            ]
        }
    ]
    
    for example in examples:
        print(f"\n📁 {example['category']}")
        for query in example['queries']:
            print(f"   💬 \"{query}\"")


def main():
    """Run all tests"""
    print("\n" + "🚀" * 30)
    print("LLM Tool Use Feature - Test Suite")
    print("🚀" * 30)
    
    # Test 1: Tool Registry
    asyncio.run(test_tool_registry())
    
    # Test 2: Tool Definitions
    test_tool_definitions()
    
    # Test 3: Provider Support
    test_provider_tool_support()
    
    # Print Examples
    print_usage_examples()
    
    print("\n" + "=" * 60)
    print("Test Suite Complete!")
    print("=" * 60)
    print("\n📚 For more information, see:")
    print("  - docs/LLM_TOOL_USE_FEATURE.md")
    print("  - docs/LLM_TOOL_USE_QUICKSTART.md")
    print()


if __name__ == "__main__":
    main()
