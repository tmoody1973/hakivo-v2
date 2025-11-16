import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type {
  CallToolResult,
  GetPromptResult,
  ListResourcesResult,
  ReadResourceResult,
  Resource,
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { AnyZodObject, z, ZodObject, ZodOptional, ZodRawShape, ZodType, ZodTypeAny, ZodTypeDef } from "zod";

// Re-export types from the SDK for convenience
export type { CompleteResourceTemplateCallback, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// Type definitions for the various callback signatures
export type ToolCallback<Args extends undefined | ZodRawShape = undefined> =
  Args extends ZodRawShape
  ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult>
  : (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult>;

export type PromptArgsRawShape = {
  [k: string]: ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};

export type PromptCallback<Args extends undefined | PromptArgsRawShape = undefined> =
  Args extends PromptArgsRawShape
  ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>
  : (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>;

export type ListResourcesCallback = (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => ListResourcesResult | Promise<ListResourcesResult>;
export type ReadResourceCallback = (uri: URL, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => ReadResourceResult | Promise<ReadResourceResult>;
export type ReadResourceTemplateCallback = (uri: URL, variables: Variables, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => ReadResourceResult | Promise<ReadResourceResult>;

export type ResourceMetadata = Omit<Resource, "uri" | "name">;

export type RegisteredTool = {
  title?: string;
  description?: string;
  inputSchema?: AnyZodObject;
  outputSchema?: AnyZodObject;
  annotations?: ToolAnnotations;
  callback: ToolCallback<undefined | ZodRawShape>;
  enabled: boolean;
  enable(): void;
  disable(): void;
  update<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape>(updates: {
    name?: string | null;
    title?: string;
    description?: string;
    paramsSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
    callback?: ToolCallback<InputArgs>;
    enabled?: boolean;
  }): void;
  remove(): void;
};

export type RegisteredResource = {
  name: string;
  title?: string;
  metadata?: ResourceMetadata;
  readCallback: ReadResourceCallback;
  enabled: boolean;
  enable(): void;
  disable(): void;
  update(updates: {
    name?: string;
    title?: string;
    uri?: string | null;
    metadata?: ResourceMetadata;
    callback?: ReadResourceCallback;
    enabled?: boolean;
  }): void;
  remove(): void;
};

export type RegisteredResourceTemplate = {
  resourceTemplate: ResourceTemplate;
  title?: string;
  metadata?: ResourceMetadata;
  readCallback: ReadResourceTemplateCallback;
  enabled: boolean;
  enable(): void;
  disable(): void;
  update(updates: {
    name?: string | null;
    title?: string;
    template?: ResourceTemplate;
    metadata?: ResourceMetadata;
    callback?: ReadResourceTemplateCallback;
    enabled?: boolean;
  }): void;
  remove(): void;
};

export type RegisteredPrompt = {
  title?: string;
  description?: string;
  argsSchema?: ZodObject<PromptArgsRawShape>;
  callback: PromptCallback<undefined | PromptArgsRawShape>;
  enabled: boolean;
  enable(): void;
  disable(): void;
  update<Args extends PromptArgsRawShape>(updates: {
    name?: string | null;
    title?: string;
    description?: string;
    argsSchema?: Args;
    callback?: PromptCallback<Args>;
    enabled?: boolean;
  }): void;
  remove(): void;
};

// Import the ResourceTemplate type from the SDK
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// Minimal public interface for MCP servers
export interface RaindropMcpServer {
  // Connection management
  connect(transport: Transport): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;

  // Notification methods
  sendResourceListChanged(): void;
  sendToolListChanged(): void;
  sendPromptListChanged(): void;

  // Initialization callback
  oninitialized?: () => void;

  // Tool registration - matching the overloads from mcp.d.ts
  tool(name: string, cb: ToolCallback): RegisteredTool;
  tool(name: string, description: string, cb: ToolCallback): RegisteredTool;
  tool<Args extends ZodRawShape>(name: string, paramsSchemaOrAnnotations: Args | ToolAnnotations, cb: ToolCallback<Args>): RegisteredTool;
  tool<Args extends ZodRawShape>(name: string, description: string, paramsSchemaOrAnnotations: Args | ToolAnnotations, cb: ToolCallback<Args>): RegisteredTool;
  tool<Args extends ZodRawShape>(name: string, paramsSchema: Args, annotations: ToolAnnotations, cb: ToolCallback<Args>): RegisteredTool;
  tool<Args extends ZodRawShape>(name: string, description: string, paramsSchema: Args, annotations: ToolAnnotations, cb: ToolCallback<Args>): RegisteredTool;

  registerTool<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations?: ToolAnnotations;
    },
    cb: ToolCallback<InputArgs>
  ): RegisteredTool;


  prompt(name: string, cb: PromptCallback): RegisteredPrompt;
  prompt(name: string, description: string, cb: PromptCallback): RegisteredPrompt;
  prompt<Args extends PromptArgsRawShape>(name: string, argsSchema: Args, cb: PromptCallback<Args>): RegisteredPrompt;
  prompt<Args extends PromptArgsRawShape>(name: string, description: string, argsSchema: Args, cb: PromptCallback<Args>): RegisteredPrompt;

  registerPrompt<Args extends PromptArgsRawShape>(
    name: string,
    config: {
      title?: string;
      description?: string;
      argsSchema?: Args;
    },
    cb: PromptCallback<Args>
  ): RegisteredPrompt;

  resource(name: string, uri: string, readCallback: ReadResourceCallback): RegisteredResource;
  resource(name: string, uri: string, metadata: ResourceMetadata, readCallback: ReadResourceCallback): RegisteredResource;
  resource(name: string, template: ResourceTemplate, readCallback: ReadResourceTemplateCallback): RegisteredResourceTemplate;
  resource(name: string, template: ResourceTemplate, metadata: ResourceMetadata, readCallback: ReadResourceTemplateCallback): RegisteredResourceTemplate;

  registerResource(
    name: string,
    uriOrTemplate: string | ResourceTemplate,
    config: ResourceMetadata,
    readCallback: ReadResourceCallback,
  ): RegisteredResource | RegisteredResourceTemplate;

  // Access to underlying server for advanced usage
  readonly server: Server;
}
