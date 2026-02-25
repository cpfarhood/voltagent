import { VoltAgent, Agent, Memory } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { kubernetesWorkflow } from "./workflows/kubernetes";
import { kubectlTool, helmTool, fluxTool, debugTool } from "./tools";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create a logger instance
const logger = createPinoLogger({
  name: "voltagent-kubernetes",
  level: process.env.LOG_LEVEL || "info",
});

// Configure memory adapter based on environment
const memory = new Memory({
  storage: process.env.MEMORY_TYPE === "libsql" 
    ? new LibSQLMemoryAdapter({ 
        url: process.env.LIBSQL_URL || "file://.voltagent/memory.db" 
      })
    : undefined, // Use in-memory by default
});

// Select model provider based on configuration
function getModel() {
  const provider = process.env.LLM_PROVIDER || "openai";
  const model = process.env.LLM_MODEL;
  
  switch (provider) {
    case "anthropic":
      return anthropic(model || "claude-3-5-sonnet-20241022");
    case "google":
      return google(model || "gemini-1.5-flash");
    case "openai":
    default:
      return openai(model || "gpt-4o-mini");
  }
}

// Kubernetes operations agent
const kubernetesAgent = new Agent({
  name: "kubernetes-agent",
  instructions: `You are a Kubernetes operations specialist AI agent. You help with:
    - Managing Kubernetes resources and deployments
    - Debugging pod issues and analyzing logs
    - Helm chart management and upgrades
    - Flux GitOps reconciliation and troubleshooting
    - Monitoring cluster health and performance
    - Providing best practices and recommendations
    
    Always prioritize safety and follow GitOps principles when making changes.`,
  model: getModel(),
  tools: [kubectlTool, helmTool, fluxTool, debugTool],
  memory,
});

// DevOps assistant agent
const devopsAgent = new Agent({
  name: "devops-assistant",
  instructions: `You are a DevOps AI assistant that helps with:
    - CI/CD pipeline design and optimization
    - Infrastructure as Code (IaC) best practices
    - Container orchestration and management
    - Security and compliance automation
    - Monitoring and observability setup
    - Incident response and troubleshooting
    
    Focus on automation, reliability, and scalability in all recommendations.`,
  model: getModel(),
  memory,
});

// Initialize VoltAgent with agents and workflows
new VoltAgent({
  agents: {
    kubernetesAgent,
    devopsAgent,
  },
  workflows: {
    kubernetesWorkflow,
  },
  server: honoServer({
    port: Number(process.env.PORT) || 3141,
    hostname: "0.0.0.0",
  }),
  logger,
});

logger.info(`VoltAgent Kubernetes Platform started on port ${process.env.PORT || 3141}`);
logger.info(`Using ${process.env.LLM_PROVIDER || "openai"} as LLM provider`);
logger.info(`Memory persistence: ${process.env.MEMORY_TYPE || "in-memory"}`);