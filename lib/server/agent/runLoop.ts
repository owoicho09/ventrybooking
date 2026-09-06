import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5';

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
  /** ACT tools get every call written to agent_actions — see tools/buyer.ts. */
  kind: 'read' | 'act';
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface RoleConfig {
  systemPrompt: string;
  tools: AgentTool[];
}

export type ChatMessage = Anthropic.MessageParam;

const MAX_ITERATIONS = 8;

/**
 * Role-agnostic manual tool-use loop — a manual loop rather than the SDK's
 * beta Tool Runner because every tool call here needs an audit-log write
 * (agent_actions) before its result goes back to the model, which the
 * runner's per-turn hooks don't give a clean seam for. Adding a role (v2:
 * organiser, admin) means writing a new RoleConfig, not touching this file.
 */
export async function runAgentLoop(role: RoleConfig, history: ChatMessage[]): Promise<ChatMessage[]> {
  // Mutates `history` in place (rather than copying) so a tool handler that
  // captured a reference to it — file_complaint's transcript snapshot — sees
  // every message pushed so far, including earlier turns in this same loop.
  const messages: ChatMessage[] = history;
  const tools: Anthropic.Tool[] = role.tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  const byName = new Map(role.tools.map(t => [t.name, t]));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: role.systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return messages;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const tool = byName.get(use.name);
      if (!tool) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'Unknown tool.', is_error: true });
        continue;
      }
      try {
        const output = await tool.handler(use.input as Record<string, unknown>);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(output) });
      } catch (err) {
        console.error(`agent tool ${tool.name} error`, err);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'This tool failed. Tell the buyer you ran into an issue and offer to file a complaint.', is_error: true });
      }
    }

    messages.push({ role: 'user', content: results });
  }

  // Ran out of iterations — return what we have rather than looping forever.
  return messages;
}
