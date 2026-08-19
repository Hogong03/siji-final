/**
 * tools.js - Agent tool registry (facade)
 * split: tools/ domain schemas + tools/executor.js dispatch/formatting
 */
export { TOOL_DEFINITIONS, QUERY_TOOLS, CONFIRM_TOOLS, buildToolsInstruction, needsConfirmation } from './tools/index.js'
export { executeTool } from './tools/executor.js'
