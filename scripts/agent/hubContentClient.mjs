/**
 * Re-export of the Hub content MCP client. Implementation lives in
 * mcp-content/ so the hosted HTTP service can deploy without Hub server
 * modules or DATABASE_URL.
 */
export {
  HUB_CONTENT_TOOLS,
  catalogOptions,
  slugify,
  resolveHubOrigin,
  createHubClient,
  callHubContentTool,
} from '../../mcp-content/lib/client.mjs'
