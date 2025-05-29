# MCP Weather Example

This project demonstrates the usage of the Model Context Protocol (MCP) to create a weather information service. It includes a client and multiple server implementations that interact with the National Weather Service (NWS) API.

## Project Structure

- `mcp-client.ts`: A command-line interface (CLI) client that connects to MCP servers and uses OpenAI's API to process user queries and interact with the available tools.
- `mcp-server-v1.ts`: An MCP server implementation using the `@modelcontextprotocol/sdk` library. It provides weather tools (`get-alerts` and `get-forecast`) over stdio.
- `mcp-server-v2.ts`: Another MCP server implementation, similar to `v1`, but using a slightly different server setup from the SDK. It also provides weather tools over stdio.
- `mcp-server-protocol.ts`: An MCP server implemented as an HTTP server using Express.js. It manually implements the JSON-RPC based MCP, providing the same weather tools over an HTTP endpoint.
- `utils.ts`: Contains utility functions for interacting with the NWS API, including making requests and formatting alert data.
- `types.ts`: Defines TypeScript types and Zod schemas for validating arguments and structuring data related to the NWS API.
- `package.json`: Defines project dependencies and scripts.
- `package-lock.json`: Records the exact versions of dependencies.
- `.gitignore`: Specifies intentionally untracked files that Git should ignore.
- `README.md`: This file.

## Features

- **Multiple Server Implementations**:
    - Stdio-based MCP server (v1 and v2 using the SDK).
    - HTTP-based MCP server (manual protocol implementation).
- **Weather Tools**:
    - `get-alerts`: Fetches weather alerts for a given US state.
    - `get-forecast`: Retrieves the weather forecast for a specific latitude and longitude.
- **OpenAI Integration**: The client uses an OpenAI model to understand natural language queries and decide which tool to call.
- **Dynamic Server Connection**: The client can connect to multiple configured MCP servers.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file in the root of the project and add your OpenAI API key:
    ```
    OPENAI_API_KEY=your_openai_api_key_here
    # Optional: Specify a different OpenAI model or base URL
    # OPENAI_MODEL=gpt-3.5-turbo
    # OPENAI_BASE_URL=https://api.openai.com/v1
    ```

## Running the Servers

You can run the different server implementations using the following commands:

-   **MCP Server V1 (stdio)**:
    ```bash
    tsx mcp-server-v1.ts
    ```
-   **MCP Server V2 (stdio)**:
    ```bash
    tsx mcp-server-v2.ts
    ```
-   **MCP Server (HTTP)**:
    ```bash
    tsx mcp-server-protocol.ts
    ```
    This server will typically run on `http://localhost:3000`.

## Running the Client

The client is configured in `mcp-client.ts`. By default, it attempts to connect to servers marked with `isOpen: true` in its configuration.

To run the client:

```bash
npx tsx mcp-client.ts
```

Once connected, you can type your weather-related queries, for example:

-   "What are the weather alerts for CA?"
-   "Get the forecast for latitude 34.05 and longitude -118.24"

The client will interact with the connected MCP server(s) and OpenAI to provide the requested information. Type `quit` to exit the client.

## How it Works

1.  The `mcp-client.ts` starts and connects to the configured MCP servers.
2.  It lists the available tools from each connected server.
3.  When the user enters a query, the client sends this query along with the list of available tools to an OpenAI model.
4.  The OpenAI model determines if any tool can fulfill the request.
5.  If a tool is chosen, the client calls the respective tool on the appropriate MCP server with the arguments identified by the OpenAI model.
6.  The MCP server executes the tool (e.g., by calling the NWS API) and returns the result.
7.  The client receives the tool's result and sends it back to the OpenAI model along with the original query and conversation history.
8.  The OpenAI model generates a final response for the user based on the tool's output.
9.  The client displays this response.

## Notes

-   The NWS API primarily provides data for locations within the United States.
-   The `mcp-server-v1.ts` and `mcp-server-v2.ts` use the `@modelcontextprotocol/sdk` for easier MCP implementation over stdio.
-   The `mcp-server-protocol.ts` demonstrates a manual implementation of the MCP over HTTP, which involves handling JSON-RPC messages directly.
-   Error handling is implemented in both client and server components.
-   The client can be extended to support more servers or different types of transport (e.g., SSE).
