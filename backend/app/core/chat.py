import os
from openai import AsyncOpenAI
from typing import List, Dict

# Configure the OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def chat_with_meeting(query: str, transcript: str, chat_history: List[Dict[str, str]]) -> str:
    """
    Generates a response to a query using the meeting transcript and chat history.
    """
    try:
        # Construct the system message
        system_message = f"""You are a helpful assistant for a meeting transcription service.
Your task is to answer questions about the following meeting transcript.
Be concise and helpful in your responses.

Meeting Transcript:
{transcript}
"""

        # Prepare the messages for the API call
        messages = [
            {"role": "system", "content": system_message}
        ]

        # Add the last 5 messages from the chat history to the messages
        messages.extend(chat_history[-5:])

        # Add the user's query
        messages.append({"role": "user", "content": query})

        # Make the API call
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=150,
            temperature=0.7,
        )

        # Extract the response text
        return response.choices[0].message.content.strip()

    except Exception as e:
        # Handle exceptions from the OpenAI API
        return f"Error: Could not get a response from the AI. {e}"
