export interface AgentContext {
  novelId: string;
  chapterIds?: string[];
  customInstruction?: string;
  signal?: AbortSignal;
  /** Pre-retrieved relevant text from RAG — if provided, agents skip random sampling */
  preRetrieved?: string;
  /** Callback to report current status/phase to the UI */
  onStatus?: (msg: string) => void;
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
