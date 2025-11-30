# Web Search Tool Documentation

## Overview

The `web_search` tool enables AI agents to search the internet for real-time information. It supports multiple search providers with automatic fallback, ensuring reliable search capabilities even when API keys are not configured.

## Features

- 🔍 **Multi-Provider Support**: Brave Search API (premium) and DuckDuckGo (free fallback)
- 🎯 **Smart Fallback**: Automatically falls back to DuckDuckGo if Brave Search fails
- 📊 **Rich Results**: Returns titles, URLs, and snippets for each result
- ⚡ **Performance Tracking**: Includes execution time metrics
- 🔒 **Privacy-Focused**: DuckDuckGo option requires no API key and respects privacy

## Search Providers

### 1. Brave Search API (Recommended)

**Status**: Premium search provider with high-quality results

**Features**:
- High-quality, comprehensive search results
- Up to 10 results per query
- Fast response times
- Commercial-grade search quality

**Requirements**:
- Brave Search API key (subscription required)
- Set `BRAVE_API_KEY` environment variable

**Pricing**: 
- Visit [Brave Search API](https://brave.com/search/api/) for current pricing
- Free tier available for testing

**API Endpoint**: `https://api.search.brave.com/res/v1/web/search`

### 2. DuckDuckGo (Fallback)

**Status**: Free, privacy-focused fallback

**Features**:
- No API key required
- Privacy-respecting search
- Instant answers for common queries
- Related topics

**Limitations**:
- Limited result set
- Less comprehensive than Brave Search
- May not return results for all queries

**API Endpoint**: `https://api.duckduckgo.com/`

## Configuration

### Environment Variables

Add to your `.env.local` file:

```bash
# Brave Search API Key (optional but recommended)
BRAVE_API_KEY=BSA_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Other API keys (for reference)
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Getting a Brave Search API Key

1. Visit [Brave Search API](https://brave.com/search/api/)
2. Sign up for an account
3. Navigate to the API dashboard
4. Generate a new API key
5. Copy the key (format: `BSA_...`)
6. Add it to your `.env.local` file

**Note**: The API key format is `BSA_` followed by a long alphanumeric string.

## Usage

### Tool Parameters

```typescript
{
  query: string;        // Required: Search query
  numResults?: number;  // Optional: Number of results (1-10, default: 5)
}
```

### Example Tool Call

```json
{
  "name": "web_search",
  "parameters": {
    "query": "latest developments in AI",
    "numResults": 5
  }
}
```

### Response Format

```typescript
{
  success: boolean;
  output: string;  // Human-readable summary
  data: {
    query: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    provider: 'brave' | 'duckduckgo';
  };
  executionTimeMs: number;
}
```

### Example Response

```json
{
  "success": true,
  "output": "Found 5 results for \"latest developments in AI\":\n\n1. AI Breakthroughs 2024\n   https://example.com/ai-2024\n   Recent advances in artificial intelligence...\n\n2. Machine Learning News\n   https://example.com/ml-news\n   Latest updates from the ML community...",
  "data": {
    "query": "latest developments in AI",
    "results": [
      {
        "title": "AI Breakthroughs 2024",
        "url": "https://example.com/ai-2024",
        "snippet": "Recent advances in artificial intelligence..."
      },
      {
        "title": "Machine Learning News",
        "url": "https://example.com/ml-news",
        "snippet": "Latest updates from the ML community..."
      }
    ],
    "provider": "brave"
  },
  "executionTimeMs": 234
}
```

## Implementation Details

### Search Priority

The tool uses the following priority order:

1. **Brave Search** (if `BRAVE_API_KEY` is set)
   - If Brave Search fails, automatically falls back to DuckDuckGo
   - Logs a warning when fallback occurs

2. **DuckDuckGo** (fallback)
   - Always available (no API key required)
   - Used when Brave Search is unavailable or fails

### Error Handling

- **API Errors**: Automatically falls back to DuckDuckGo
- **Network Errors**: Returns error message with details
- **Invalid Parameters**: Validates and constrains `numResults` to 1-10 range
- **No Results**: Returns success with empty results array

### Performance

- **Brave Search**: Typically 200-500ms response time
- **DuckDuckGo**: Typically 100-300ms response time
- Execution time is tracked and included in response

## Code Location

**Implementation**: `packages/infrastructure/src/adapters/tools/index.ts`

**Key Classes**:
- `SearchTool` (lines 673-805): Main tool implementation
- `createDefaultTools()` (line 814): Tool registration

**Configuration**: `packages/infrastructure/src/config/bootstrap.ts`

**Key Functions**:
- `loadConfig()`: Loads `BRAVE_API_KEY` from environment
- `registerTools()`: Registers SearchTool with API keys

## Testing

### Manual Testing

1. **Test with Brave Search**:
   ```bash
   # Set API key
   export BRAVE_API_KEY=BSA_your_key_here
   
   # Start the application
   npm run dev
   
   # Create an agent with web_search tool enabled
   # Send a message: "Search for latest AI news"
   ```

2. **Test without API key** (DuckDuckGo fallback):
   ```bash
   # Don't set BRAVE_API_KEY
   npm run dev
   
   # Create an agent with web_search tool enabled
   # Send a message: "Search for Python tutorials"
   ```

### Expected Behavior

**With Brave API Key**:
- Console log: `🔍 Web search: Brave Search API enabled`
- Search results use Brave Search API
- Higher quality, more comprehensive results

**Without Brave API Key**:
- Console log: `🔍 Web search: DuckDuckGo (fallback, no API key required)`
- Search results use DuckDuckGo API
- Basic results, privacy-focused

## Troubleshooting

### "Brave Search API returned 401"

**Problem**: Invalid or expired API key

**Solution**:
1. Verify your API key in `.env.local`
2. Check that the key format is correct (`BSA_...`)
3. Ensure the key is active in your Brave Search dashboard
4. Restart the application after updating the key

### "Brave Search failed, falling back to DuckDuckGo"

**Problem**: Brave Search API request failed

**Possible Causes**:
- Network connectivity issues
- API rate limit exceeded
- Invalid query parameters
- Temporary API outage

**Solution**:
- The tool automatically falls back to DuckDuckGo
- Check console logs for specific error details
- Verify network connectivity
- Check Brave Search API status page

### No Results Returned

**Problem**: Search returns empty results

**Possible Causes**:
- Query too specific or obscure
- Search provider has no results
- API response format changed

**Solution**:
- Try a more general query
- Check if the search provider is working
- Review API response in console logs

### Search Tool Not Available

**Problem**: Tool doesn't appear in available tools list

**Solution**:
1. Verify the tool is registered in `createDefaultTools()`
2. Check application startup logs for tool registration
3. Ensure no errors during bootstrap
4. Restart the application

## Best Practices

### For Agent Developers

1. **Always specify numResults**: Helps control token usage
   ```typescript
   { query: "...", numResults: 5 }  // Good
   { query: "..." }                  // Also fine (defaults to 5)
   ```

2. **Handle empty results**: Check if results array is empty
   ```typescript
   if (result.data.results.length === 0) {
     // Try a different query or inform user
   }
   ```

3. **Use provider information**: Different providers may have different result quality
   ```typescript
   if (result.data.provider === 'brave') {
     // Higher confidence in results
   }
   ```

### For System Administrators

1. **Monitor API Usage**: Track Brave Search API usage to avoid overages
2. **Set Rate Limits**: Consider implementing rate limiting for agents
3. **Cache Results**: Consider caching common queries to reduce API calls
4. **Monitor Costs**: Track API costs if using paid Brave Search tier

## API Reference

### Brave Search API

**Endpoint**: `GET https://api.search.brave.com/res/v1/web/search`

**Headers**:
```
Accept: application/json
Accept-Encoding: gzip
X-Subscription-Token: BSA_your_api_key
```

**Query Parameters**:
- `q`: Search query (required)
- `count`: Number of results (1-20, default: 10)
- `search_lang`: Search language (default: 'en')
- `country`: Country code (default: 'US')
- `safesearch`: Safe search level ('off', 'moderate', 'strict')

**Response Format**:
```json
{
  "web": {
    "results": [
      {
        "title": "Result Title",
        "url": "https://example.com",
        "description": "Result description",
        "snippet": "Result snippet"
      }
    ]
  }
}
```

### DuckDuckGo API

**Endpoint**: `GET https://api.duckduckgo.com/`

**Query Parameters**:
- `q`: Search query (required)
- `format`: Response format ('json')
- `no_html`: Remove HTML (1)
- `skip_disambig`: Skip disambiguation (1)

**Response Format**:
```json
{
  "AbstractText": "Instant answer text",
  "AbstractURL": "https://example.com",
  "Heading": "Result heading",
  "RelatedTopics": [
    {
      "Text": "Related topic text",
      "FirstURL": "https://example.com"
    }
  ]
}
```

## Future Enhancements

Potential improvements for the web search tool:

- [ ] Result caching to reduce API calls
- [ ] Support for additional search providers (Google Custom Search, Bing)
- [ ] Image search support
- [ ] News search support
- [ ] Search result ranking and relevance scoring
- [ ] Automatic query refinement
- [ ] Multi-language search support
- [ ] Search result summarization

## Support

For issues or questions:

1. Check this documentation
2. Review console logs for error details
3. Verify API key configuration
4. Test with different queries
5. Check search provider status pages

## License

This tool is part of the Local Agent Builder project. See the main project README for license information.

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0.0

