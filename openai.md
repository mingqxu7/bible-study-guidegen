# OpenAI API Documentation

## Overview

The OpenAI API provides developers with access to OpenAI's powerful language models and AI capabilities. The API uses a REST interface with a base URL of `https://api.openai.com/v1`.

## Authentication

All API requests require authentication using an API key:
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Models (2025)

### Reasoning Models (o-series)
- **o3** (Released: April 16, 2025) - Most powerful reasoning model
  - Makes 20% fewer major errors than o1 on difficult tasks
  - Excels in programming, business/consulting, and creative ideation
- **o3-mini** (Released: January 31, 2025) - Smaller, efficient alternative to o3
- **o4-mini** (Released: April 16, 2025) - Faster, more affordable reasoning model
  - Best-performing on AIME 2024 and 2025
- **o1** (Released: December 5, 2024) - Previous full o-series reasoning model
- **o1-mini** (Released: December 5, 2024) - Small model alternative to o1
- **o1-pro** (Released: March 2025) - Enhanced version of o1

### GPT Models
- **gpt-4.1** (Released: April 14, 2025) - Flagship GPT model
  - Supports up to 1 million tokens of context
  - Knowledge cutoff: June 2024
- **gpt-4o** (Released: May 13, 2024) - Fast, intelligent, and flexible
  - Multimodal: text, image, and audio
- **gpt-4o-audio-preview** (Released: February 5, 2025) - Audio processing capabilities
- **chatgpt-4o-latest** (Released: March 26, 2025) - Optimized for conversations
- **gpt-4.1-mini** (Released: April 14, 2025) - Balanced for intelligence, speed, and cost
- **gpt-4o-mini** (Released: July 18, 2024) - Fast, affordable small model
- **gpt-4o-mini-audio-preview** (Released: February 5, 2025) - With audio capabilities
- **gpt-3.5-turbo** - Previous generation, still available

### Specialized Models
- **gpt-image-1** (Released: April 15, 2025) - Latest image generation model
  - Major improvements over DALL-E
  - Better at precise instructions
  - Reliably renders text
  - Accepts images as input for editing and inpainting
- **gpt-4o-transcribe** - Speech to text
- **gpt-4o-mini-transcribe** - Lightweight speech to text
- **text-embedding-3-small** - Highly efficient embedding model
- **text-embedding-3-large** - Next generation embedding model (up to 3072 dimensions)

## API Endpoints

### Chat Completions
**POST** `/v1/chat/completions`
```json
{
  "model": "gpt-4.1",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7
}
```

### Completions (Legacy)
**POST** `/v1/completions`
- Note: Not compatible with GPT-3.5 Turbo and GPT-4 models
- Use chat completions endpoint instead

### Models
**GET** `/v1/models`
- Lists all available models

**GET** `/v1/models/{model}`
- Retrieves information about a specific model

### Embeddings
**POST** `/v1/embeddings`
```json
{
  "model": "text-embedding-3-small",
  "input": "The quick brown fox jumps over the lazy dog"
}
```

### Images
**POST** `/v1/images/generations`
- Generate images from text prompts

**POST** `/v1/images/edits`
- Edit existing images with text prompts

**POST** `/v1/images/variations`
- Create variations of existing images

### Audio
**POST** `/v1/audio/transcriptions`
- Transcribe audio to text

**POST** `/v1/audio/translations`
- Translate audio to English text

**POST** `/v1/audio/speech`
- Generate audio from text (TTS)

### Moderation
**POST** `/v1/moderations`
- Check if content complies with usage policies
- Free to use

### Fine-tuning
**POST** `/v1/fine_tuning/jobs`
- Create a fine-tuning job

**GET** `/v1/fine_tuning/jobs`
- List fine-tuning jobs

**GET** `/v1/fine_tuning/jobs/{fine_tuning_job_id}`
- Retrieve fine-tuning job details

**POST** `/v1/fine_tuning/jobs/{fine_tuning_job_id}/cancel`
- Cancel a fine-tuning job

### Files
**POST** `/v1/files`
- Upload a file for fine-tuning or assistants

**GET** `/v1/files`
- List files

**DELETE** `/v1/files/{file_id}`
- Delete a file

**GET** `/v1/files/{file_id}`
- Retrieve file information

**GET** `/v1/files/{file_id}/content`
- Retrieve file content

### Assistants API
**POST** `/v1/assistants`
- Create an assistant

**GET** `/v1/assistants`
- List assistants

**GET** `/v1/assistants/{assistant_id}`
- Retrieve an assistant

**POST** `/v1/assistants/{assistant_id}`
- Modify an assistant

**DELETE** `/v1/assistants/{assistant_id}`
- Delete an assistant

### Threads
**POST** `/v1/threads`
- Create a thread

**GET** `/v1/threads/{thread_id}`
- Retrieve a thread

**POST** `/v1/threads/{thread_id}`
- Modify a thread

**DELETE** `/v1/threads/{thread_id}`
- Delete a thread

### Messages
**POST** `/v1/threads/{thread_id}/messages`
- Create a message

**GET** `/v1/threads/{thread_id}/messages`
- List messages

**GET** `/v1/threads/{thread_id}/messages/{message_id}`
- Retrieve a message

**POST** `/v1/threads/{thread_id}/messages/{message_id}`
- Modify a message

### Runs
**POST** `/v1/threads/{thread_id}/runs`
- Create a run

**GET** `/v1/threads/{thread_id}/runs`
- List runs

**GET** `/v1/threads/{thread_id}/runs/{run_id}`
- Retrieve a run

**POST** `/v1/threads/{thread_id}/runs/{run_id}`
- Modify a run

**POST** `/v1/threads/{thread_id}/runs/{run_id}/cancel`
- Cancel a run

### Vector Stores (Beta)
**POST** `/v1/vector_stores`
- Create a vector store

**GET** `/v1/vector_stores`
- List vector stores

**GET** `/v1/vector_stores/{vector_store_id}`
- Retrieve a vector store

**POST** `/v1/vector_stores/{vector_store_id}`
- Modify a vector store

**DELETE** `/v1/vector_stores/{vector_store_id}`
- Delete a vector store

## New Features (2025)

### Built-in Tools
As of May 2025, new built-in tools added to the Responses API include:
- Remote MCP servers
- Image Generation
- Code Interpreter
- Upgraded File Search
- Background mode
- Encrypted content

### Enhanced Capabilities
- Reasoning models can agentically use and combine every tool within ChatGPT
- Web searching
- Analyzing uploaded files with Python
- Reasoning deeply about visual inputs
- Generating images

## Rate Limits

Rate limits vary by model and subscription tier:
- Free tier: Limited requests per minute
- Paid tiers: Higher limits based on plan
- Enterprise: Custom limits

## Best Practices

1. **Error Handling**: Implement exponential backoff for rate limit errors
2. **Token Management**: Monitor token usage to control costs
3. **Model Selection**: Choose appropriate models for your use case
4. **Streaming**: Use streaming for real-time responses
5. **Security**: Never expose API keys in client-side code

## Azure OpenAI

For Azure users, endpoints follow this pattern:
```
https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/{endpoint}?api-version=2024-10-21
```

Latest GA API version: `2024-10-21`

Starting May 2025, Azure offers next generation v1 APIs with ongoing access to latest features without updating api-version.

## SDKs

Official SDKs available:
- Python: `pip install openai`
- Node.js: `npm install openai`
- .NET: `dotnet add package OpenAI`
- Java: Available via Maven
- Go: `go get github.com/openai/openai-go`

## Resources

- Official Documentation: https://platform.openai.com/docs
- API Reference: https://platform.openai.com/docs/api-reference
- Models Guide: https://platform.openai.com/docs/models
- Pricing: https://openai.com/pricing
- Status: https://status.openai.com

## Notes

- "o2" was intentionally skipped to avoid brand conflicts with telecom company O2
- The `/v1/edits` endpoint has been deprecated as of January 2024
- Moderation endpoint is free to use for all users
- Chat completions support both text and image inputs for multimodal models