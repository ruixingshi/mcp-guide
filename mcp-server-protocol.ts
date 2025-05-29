import express from "express";
import bodyParser from "body-parser";
import { z } from "zod";
// Import shared types and utils for NWS API
import {
  AlertsArgumentsSchema,
  ForecastArgumentsSchema,
  type AlertsResponse,
  type ForecastResponse,
  type PointsResponse,
  type ForecastPeriod,
} from "./types.js";
import {
  NWS_API_BASE,
  // USER_AGENT, // USER_AGENT is used by makeNWSRequest in utils.ts, not directly here
  makeNWSRequest,
  formatAlert,
} from "./utils.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// MCP Protocol Handlers

// Handle initialize request
const handleInitialize = (id: string) => {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2024-11-05", // Using a common protocol version
      serverInfo: {
        name: "simple-mcp-server-with-weather",
        version: "1.0.0",
      },
      capabilities: {
        tools: {}, // Will be populated by tools/list
      },
    },
  };
};

// Handle tools list request
const handleToolsList = (id: string) => {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "get-alerts",
          description: "Get weather alerts for a state",
          inputSchema: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: "Two-letter state code (e.g. CA, NY)",
              },
            },
            required: ["state"],
          },
        },
        {
          name: "get-forecast",
          description: "Get weather forecast for a location",
          inputSchema: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                description: "Latitude of the location",
              },
              longitude: {
                type: "number",
                description: "Longitude of the location",
              },
            },
            required: ["latitude", "longitude"],
          },
        },
      ],
    },
  };
};

// Handle tool call request
const handleToolCall = async (id: string, params: any) => {
  const { name, arguments: args } = params;

  try {
    if (name === "get-alerts") {
      const { state } = AlertsArgumentsSchema.parse(args);
      const stateCode = state.toUpperCase();

      const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
      const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

      if (!alertsData) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "Failed to retrieve alerts data",
              },
            ],
          },
        };
      }

      const features = alertsData.features || [];
      if (features.length === 0) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `No active alerts for ${stateCode}`,
              },
            ],
          },
        };
      }

      const formattedAlerts = features.map(formatAlert).slice(0, 20);
      const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
        "\n"
      )}`;

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: alertsText,
            },
          ],
        },
      };
    } else if (name === "get-forecast") {
      const { latitude, longitude } = ForecastArgumentsSchema.parse(args);

      const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
        4
      )},${longitude.toFixed(4)}`;
      const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

      if (!pointsData) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
              },
            ],
          },
        };
      }

      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "Failed to get forecast URL from grid point data",
              },
            ],
          },
        };
      }

      const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
      if (!forecastData) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "Failed to retrieve forecast data",
              },
            ],
          },
        };
      }

      const periods = forecastData.properties?.periods || [];
      if (periods.length === 0) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "No forecast periods available",
              },
            ],
          },
        };
      }

      const formattedForecast = periods.map((period: ForecastPeriod) =>
        [
          `${period.name || "Unknown"}:`,
          `Temperature: ${period.temperature || "Unknown"}°${
            period.temperatureUnit || "F"
          }`,
          `Wind: ${period.windSpeed || "Unknown"} ${
            period.windDirection || ""
          }`,
          `${period.shortForecast || "No forecast available"}`,
          "---",
        ].join("\n")
      );

      const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
        "\n"
      )}`;

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: forecastText,
            },
          ],
        },
      };
    } else {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601, // Method not found
          message: `Tool not found: ${name}`,
        },
      };
    }
  } catch (error) {
    // Handle Zod validation errors and other errors
    if (error instanceof z.ZodError) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32602, // Invalid params
          message: `Invalid arguments: ${error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ")}`,
        },
      };
    }
    // For other errors, return a generic internal error
    console.error("Error in tool call:", error);
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000, // Internal error
        message: "Internal server error during tool execution.",
      },
    };
  }
};

// Handle resources or prompts list request
const handleResourcesOrPromptsList = (id: string, method: string) => {
  const resultKey = method.split("/")[0]; // "resources" or "prompts"
  return {
    jsonrpc: "2.0",
    id,
    result: {
      [resultKey]: [],
    },
  };
};

// Handle unknown method
const handleUnknownMethod = (id: string) => {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: "Method not found",
    },
  };
};

// Process JSON-RPC request
const processJsonRpcRequest = async (body: any) => {
  if (
    !body ||
    typeof body.method !== "string" ||
    typeof body.id === "undefined"
  ) {
    return {
      jsonrpc: "2.0",
      id: body?.id || null,
      error: {
        code: -32600, // Invalid Request
        message: "Invalid JSON-RPC request",
      },
    };
  }

  const { method, id, params } = body;

  if (method === "initialize") {
    return handleInitialize(id);
  }

  if (method === "tools/list") {
    return handleToolsList(id);
  }

  if (method === "tools/call") {
    return await handleToolCall(id, params);
  }

  if (method === "resources/list" || method === "prompts/list") {
    return handleResourcesOrPromptsList(id, method);
  }

  return handleUnknownMethod(id);
};

// Main MCP endpoint
app.post("/", async (req, res) => {
  const requestBody = req.body;
  const responseData = await processJsonRpcRequest(requestBody);
  res.json(responseData);
});

// Handle OPTIONS requests for CORS preflight
app.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id"
  );
  res.header("Access-Control-Max-Age", "86400");
  res.sendStatus(204);
});

app.listen(port, () => {
  console.log(
    `Simple MCP Server with Weather (HTTP) running at http://localhost:${port}` // Differentiate log message
  );
});

// Basic error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      jsonrpc: "2.0",
      id: (req.body as any)?.id || null,
      error: {
        code: -32000, // Internal error
        message: "Internal server error",
      },
    });
  }
);

export default app;
