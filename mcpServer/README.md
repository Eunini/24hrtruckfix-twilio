# MongoDB MCP Server

A Model Context Protocol (MCP) server that provides MongoDB database access through OpenAI's Responses API integration.

## Features

- **Official MCP SDK**: Uses the official `@modelcontextprotocol/sdk` package
- **MongoDB Integration**: Direct connection to MongoDB Atlas
- **Multiple Tools**: Query, aggregate, analyze, and explore MongoDB collections
- **Schema Analysis**: Automatic schema detection and analysis
- **STDIO Transport**: Compatible with OpenAI's MCP integration

## Available Tools

### 1. `mongodb_find`
Find documents in a MongoDB collection with optional filtering, sorting, and limiting.

**Parameters:**
- `collection` (required): Collection name to query
- `query` (optional): MongoDB query filter (defaults to `{}`)
- `limit` (optional): Maximum number of documents to return (max 100, defaults to 10)
- `sort` (optional): Sort specification (e.g., `{'name': 1, 'age': -1}`)

### 2. `mongodb_aggregate`
Execute aggregation pipeline on a MongoDB collection.

**Parameters:**
- `collection` (required): Collection name
- `pipeline` (required): Array of aggregation stages

### 3. `mongodb_list_collections`
List all collections in the database.

**Parameters:** None

### 4. `mongodb_count_documents`
Count documents in a collection with optional filter.

**Parameters:**
- `collection` (required): Collection name
- `query` (optional): Count filter (defaults to `{}`)

### 5. `mongodb_analyze_schema`
Analyze the schema structure of a collection by sampling documents.

**Parameters:**
- `collection` (required): Collection name to analyze
- `sampleSize` (optional): Number of documents to sample (max 1000, defaults to 100)

## Installation

```bash
npm install
```

## Usage

### Running the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

### Testing the Server

```bash
node test-mcp.js
```

## OpenAI Integration

To use this MCP server with OpenAI's Responses API:

1. **Deploy the server** to a publicly accessible endpoint
2. **Configure OpenAI** to use your MCP server URL
3. **Use the tools** in your AI conversations

### Example OpenAI Configuration

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "node",
      "args": ["new-ncp.js"],
      "env": {}
    }
  }
}
```

## Database Configuration

The server automatically connects to MongoDB Atlas using the connection string in the code. Update the `connectionString` variable in `new-ncp.js` to point to your MongoDB instance.

## Architecture

This implementation uses the official MCP SDK with the following components:

- **Server**: `createServer()` from `@modelcontextprotocol/sdk/server`
- **Transport**: `StdioServerTransport` for standard I/O communication
- **Request Handlers**: Proper handlers for `ListToolsRequestSchema` and `CallToolRequestSchema`
- **Error Handling**: Comprehensive error handling and graceful shutdown

## Key Improvements from Previous Version

1. **Official SDK**: Uses the official MCP SDK instead of custom implementation
2. **Proper Protocol**: Follows the MCP protocol specification correctly
3. **Better Error Handling**: More robust error handling and validation
4. **STDIO Transport**: Uses standard I/O for better compatibility
5. **Type Safety**: Better type definitions and validation
6. **Cleaner Code**: More maintainable and readable codebase

## Development

### Project Structure

```
mcpServer/
├── new-ncp.js          # Main MCP server implementation
├── test-mcp.js         # Test script for the server
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

### Adding New Tools

To add a new MongoDB tool:

1. Add the tool definition to the `ListToolsRequestSchema` handler
2. Add the tool implementation to the `CallToolRequestSchema` handler
3. Update the README with tool documentation

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**: Check your connection string and network access
2. **Tool Not Found**: Ensure the tool name matches exactly in both handlers
3. **Permission Denied**: Make sure the server has read/write access to the database

### Debug Mode

Run with additional logging:

```bash
DEBUG=* node new-ncp.js
```

## License

ISC License 