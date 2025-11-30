# Wikipedia Tool Documentation

## Overview

The `wikipedia` tool enables AI agents to search and retrieve Wikipedia articles with intelligent caching. Articles are cached locally for 7 days, providing fast subsequent access and reducing API calls to Wikipedia.

## Features

- 🔍 **Search Wikipedia**: Find articles by keyword
- 📄 **Get Full Articles**: Retrieve complete article content
- 📝 **Get Summaries**: Quick access to article summaries
- 💾 **Intelligent Caching**: Articles cached for 7 days
- ⚡ **Fast Retrieval**: Cache hits return instantly
- 🧹 **Auto-Expiration**: Old cache entries automatically expire

## Tool Parameters

```typescript
{
  query: string;        // Required: Article title or search query
  action?: string;     // Optional: "search" | "get" | "summary" (default: "get")
}
```

## Actions

### 1. Search (`action: "search"`)

Search for Wikipedia articles matching a query.

**Example:**
```json
{
  "name": "wikipedia",
  "parameters": {
    "query": "artificial intelligence",
    "action": "search"
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "Found 10 articles matching \"artificial intelligence\"",
  "data": {
    "query": "artificial intelligence",
    "results": [
      {
        "title": "Artificial intelligence",
        "snippet": "Artificial intelligence (AI) is intelligence demonstrated by machines...",
        "wordcount": 12345,
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "action": "search"
  },
  "executionTimeMs": 234
}
```

### 2. Get Full Article (`action: "get"` or default)

Retrieve the complete Wikipedia article content. Results are cached for 7 days.

**Example:**
```json
{
  "name": "wikipedia",
  "parameters": {
    "query": "Machine Learning",
    "action": "get"
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "Machine learning (ML) is a method of data analysis...",
  "data": {
    "title": "Machine learning",
    "summary": "Machine learning (ML) is a method of data analysis...",
    "content": "Machine learning (ML) is a method of data analysis...",
    "url": "https://en.wikipedia.org/wiki/Machine_learning",
    "cached": false,
    "lastUpdated": "2025-01-15T10:30:00Z"
  },
  "executionTimeMs": 456
}
```

**Cached Response:**
```json
{
  "success": true,
  "output": "Machine learning (ML) is a method of data analysis...",
  "data": {
    "title": "Machine learning",
    "summary": "Machine learning (ML) is a method of data analysis...",
    "content": "Machine learning (ML) is a method of data analysis...",
    "url": "https://en.wikipedia.org/wiki/Machine_learning",
    "cached": true,
    "lastUpdated": "2025-01-10T08:00:00Z"
  },
  "executionTimeMs": 12
}
```

### 3. Get Summary (`action: "summary"`)

Retrieve only the article summary (first paragraph or ~500 characters). Faster and uses less cache space.

**Example:**
```json
{
  "name": "wikipedia",
  "parameters": {
    "query": "Quantum Computing",
    "action": "summary"
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "Quantum computing is a type of computation...",
  "data": {
    "title": "Quantum computing",
    "summary": "Quantum computing is a type of computation...",
    "url": "https://en.wikipedia.org/wiki/Quantum_computing",
    "cached": false,
    "lastUpdated": "2025-01-15T10:30:00Z"
  },
  "executionTimeMs": 234
}
```

## Caching System

### Cache Location

Articles are cached in:
```
workspace/.cache/wikipedia/articles/
```

Each article is stored as a JSON file with a normalized filename:
- `artificial_intelligence.json`
- `machine_learning.json`
- `quantum_computing.json`

### Cache Structure

Each cached article contains:
```json
{
  "title": "Article Title",
  "summary": "Article summary...",
  "content": "Full article content...",
  "url": "https://en.wikipedia.org/wiki/Article_Title",
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

### Cache Expiration

- **Default TTL**: 7 days
- **Automatic Expiration**: Expired entries are ignored on read
- **Manual Cleanup**: Use `clearExpiredCache()` method (if exposed)

### Cache Benefits

1. **Speed**: Cached articles return in ~10-20ms vs 200-500ms for API calls
2. **Reliability**: Works offline for cached articles
3. **Rate Limiting**: Reduces load on Wikipedia API
4. **Cost**: No API costs (Wikipedia is free, but caching reduces bandwidth)

## Implementation Details

### Code Location

**Implementation**: `packages/infrastructure/src/adapters/tools/index.ts`

**Key Class**: `WikipediaTool` (lines ~885-1120)

**Registration**: Registered in `createDefaultTools()` function

### Cache Key Normalization

Article titles are normalized for safe filenames:
- Spaces → underscores
- Special characters removed
- Lowercase conversion

Example: `"Machine Learning"` → `"machine_learning"`

### Content Cleaning

Wikipedia content is automatically cleaned:
- Excessive newlines reduced (max 2 consecutive)
- Line trimming
- Whitespace normalization

### Summary Extraction

Summaries are extracted intelligently:
- First paragraph if ≤500 characters
- Otherwise, truncated at sentence boundary (~500 chars)

## Usage Examples

### Example 1: Research Workflow

```typescript
// Step 1: Search for articles
{
  "name": "wikipedia",
  "parameters": {
    "query": "neural networks",
    "action": "search"
  }
}

// Step 2: Get summary of interesting article
{
  "name": "wikipedia",
  "parameters": {
    "query": "Neural network",
    "action": "summary"
  }
}

// Step 3: Get full article if needed
{
  "name": "wikipedia",
  "parameters": {
    "query": "Neural network",
    "action": "get"
  }
}
```

### Example 2: Quick Lookup

```typescript
// Get summary for quick reference
{
  "name": "wikipedia",
  "parameters": {
    "query": "Python programming language",
    "action": "summary"
  }
}
```

### Example 3: Deep Research

```typescript
// Get full article for comprehensive research
{
  "name": "wikipedia",
  "parameters": {
    "query": "Artificial Intelligence",
    "action": "get"
  }
}
```

## Best Practices

### For Agent Developers

1. **Use Search First**: When exploring a topic, use `search` to find relevant articles
2. **Summary for Quick Checks**: Use `summary` for quick fact-checking
3. **Full Article for Research**: Use `get` when you need comprehensive information
4. **Check Cache Status**: The `cached` field indicates if result came from cache

### For System Administrators

1. **Monitor Cache Size**: Cache grows over time (check `workspace/.cache/wikipedia/`)
2. **Periodic Cleanup**: Consider clearing expired cache periodically
3. **Backup Cache**: Cache directory can be backed up for faster agent initialization
4. **Disk Space**: Monitor disk usage (each article ~10-100KB)

## Troubleshooting

### "Article not found" Error

**Problem**: Wikipedia doesn't have an article with that exact title

**Solutions**:
1. Use `search` action first to find correct article title
2. Check spelling and capitalization
3. Try alternative names or synonyms

### Cache Not Working

**Problem**: Articles always fetched from API, never from cache

**Possible Causes**:
- Cache directory permissions issue
- Cache files corrupted
- Cache expired

**Solution**:
1. Check `workspace/.cache/wikipedia/articles/` directory exists
2. Verify file permissions
3. Check console logs for cache errors

### Slow Performance

**Problem**: Wikipedia queries are slow

**Solutions**:
1. Use `summary` instead of `get` for faster results
2. Check network connectivity
3. Verify Wikipedia API is accessible
4. Consider using cached articles when possible

## API Reference

### Wikipedia API Endpoints Used

**Search Endpoint**:
```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &list=search
  &srsearch={query}
  &srlimit=10
  &format=json
  &origin=*
```

**Article Endpoint**:
```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &prop=extracts
  &exintro={0|1}
  &explaintext=1
  &titles={title}
  &format=json
  &origin=*
```

### Rate Limits

Wikipedia API has rate limits:
- **No API key required** (public API)
- **Rate limit**: ~200 requests/minute per IP
- **Caching helps**: Reduces API calls significantly

## Integration with Other Tools

The Wikipedia tool works well with:

1. **Web Search Tool**: Use `web_search` to find topics, then `wikipedia` for authoritative info
2. **File Tool**: Save Wikipedia articles to workspace for later reference
3. **HTTP Tool**: Can fetch Wikipedia pages directly if needed

## Future Enhancements

Potential improvements:

- [ ] Multi-language support (currently English only)
- [ ] Image extraction from articles
- [ ] Related articles suggestions
- [ ] Citation extraction
- [ ] Category browsing
- [ ] Cache statistics API
- [ ] Configurable cache TTL
- [ ] Cache compression

## Support

For issues or questions:

1. Check this documentation
2. Review console logs for cache operations
3. Verify Wikipedia API is accessible
4. Check cache directory permissions
5. Test with simple queries first

## License

This tool uses the Wikipedia API, which is freely available. Wikipedia content is licensed under Creative Commons Attribution-ShareAlike 3.0.

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0.0

