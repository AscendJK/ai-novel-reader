export interface AgentContext {
  novelId: string;
  chapterIds?: string[];
  customInstruction?: string;
  signal?: AbortSignal;
  /** Pre-retrieved relevant text from RAG — if provided, agents skip random sampling */
  preRetrieved?: string;
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
  tokensUsed?: number;
}

export interface Agent {
  name: string;
  description: string;
  run(context: AgentContext): Promise<AgentResult>;
}

export interface OrchestratorTask {
  id: string;
  agentName: string;
  context: AgentContext;
  dependsOn?: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: AgentResult;
}
