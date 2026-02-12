/**
 * Marlowe Copilot Runtime – Node bridge between React CopilotKit and FastAPI LangGraph agent.
 * Proxies agent requests to the backend AG-UI endpoint.
 */
import express from "express";
import cors from "cors";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const AGENT_URL =
  process.env.AGENT_URL || "http://backend:8000/api/v1/copilotkit";

const serviceAdapter = new ExperimentalEmptyAdapter();
const runtime = new CopilotRuntime({
  agents: {
    marlowe_agent: new LangGraphHttpAgent({ url: AGENT_URL }),
    free_chat_agent: new LangGraphHttpAgent({
      url: AGENT_URL.replace(/\/?$/, "") + "/free",
    }),
  },
});

const copilotRuntime = copilotRuntimeNodeExpressEndpoint({
  endpoint: "/api/copilotkit",
  runtime,
  serviceAdapter,
});

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["*"],
  })
);
app.use("/", copilotRuntime);

const PORT = parseInt(process.env.PORT || "3010", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Copilot runtime listening at http://0.0.0.0:${PORT}/api/copilotkit (agent: ${AGENT_URL})`);
});
