import Anthropic from '@anthropic-ai/sdk';
import { recordUsage } from '@/lib/server/agent/usage';

const client = new Anthropic();
// Haiku 4.5 rather than 5.5 to stretch a small prepaid credit: 5.5 spends
// output tokens on thinking every turn and its tokenizer counts ~25% more
// tokens for the same prompt. Pricing in usage.ts must match this model.
const MODEL = 'claude-haiku-4-5';
// Replies are phone-chat length; this only caps a runaway answer.
const MAX_TOKENS = 500;
// A tool result is JSON for the model; cap it so one big row can't bloat
// every later call in the conversation.
const MAX_TOOL_RESULT_CHARS = 2000;

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
  /** ACT tools get every call written to agent_actions — see tools/buyer.ts. */
  kind: 'read' | 'act';
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface RoleConfig {
  /** Identical for every conversation: prompt-cached together with the tools. */
  systemPrompt: string;
  /** Per-conversation bits (e.g. who is signed in), sent after the cached part. */
  systemSuffix?: string;
  tools: AgentTool[];
}

export type ChatMessage = Anthropic.MessageParam;

const MAX_ITERATIONS = 5;

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
  // Prompt caching: tools + the fixed system prompt (~4.3k tokens, above
  // Haiku's 4,096-token minimum) are written to the cache once and then read
  // at a tenth of the price on every later call within 5 minutes, i.e. the
  // rest of the conversation. The breakpoint on the system block covers the
  // tools too, since they come first in the prompt.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: role.systemPrompt, cache_control: { type: 'ephemeral' } },
  ];
  if (role.systemSuffix) system.push({ type: 'text', text: role.systemSuffix });
  const byName = new Map(role.tools.map(t => [t.name, t]));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    });
    await recordUsage(response.usage);

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
        const json = JSON.stringify(output) ?? 'null';
        results.push({ type: 'tool_result', tool_use_id: use.id, content: json.length > MAX_TOOL_RESULT_CHARS ? `${json.slice(0, MAX_TOOL_RESULT_CHARS)}…(truncated)` : json });
      } catch (err) {
        console.error(`agent tool ${tool.name} error`, err);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'This tool failed. Tell the customer you ran into an issue and offer to file a complaint.', is_error: true });
      }
    }

    messages.push({ role: 'user', content: results });
  }

  // Ran out of iterations — return what we have rather than looping forever.
  return messages;
}
