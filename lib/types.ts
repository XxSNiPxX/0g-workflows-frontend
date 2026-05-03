export type AgentType = 'txt' | 'emb' | 'vec' | 'report' | string;

export interface Agent {
  id: number;
  name: string;
  description: string;
  address: string;
  creator: string;
  inputTypes: AgentType[];
  outputType: AgentType;
  costPerRequest: string;
  workflowReady: boolean;
  active: boolean;
}

export interface GraphNode {
  id: string;         // local canvas ID
  name: string;
  address: string;
  input: AgentType;
  output: AgentType;
  cost: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;   // GraphNode id
  to:   string;
}

export interface WorkflowStep {
  name:       string;
  agent:      string;   // address
  inputType:  AgentType;
  outputType: AgentType;
}

export interface WorkflowMeta {
  id:        string;
  address:   string;
  label:     string;
  steps:     WorkflowStep[];
  totalCost: string;
  createdAt: number;
}

export interface RunMeta {
  id:                  string;
  workflowAddress:     string;
  workflowLabel:       string;
  steps:               WorkflowStep[];
  currentStep:         number;
  status:              'running' | 'done';
  inputPreview:        string;
  cost:                string;
  finalPointer:        string | null;
  startedAt:           number;
}
