/**
 * AI Model Router
 * ================
 * Selects the optimal model for each task based on requirements
 */

import { AIModel, AITaskType } from "./types";

interface ModelConfig {
  id: AIModel;
  provider: "openai" | "anthropic";
  apiModel: string;
  costPer1kTokens: number;
  avgLatencyMs: number;
  maxContextTokens: number;
  strengths: string[];
}

const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    costPer1kTokens: 0.005,
    avgLatencyMs: 2000,
    maxContextTokens: 128000,
    strengths: ["complex_reasoning", "structured_output", "accuracy"],
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    costPer1kTokens: 0.00015,
    avgLatencyMs: 500,
    maxContextTokens: 128000,
    strengths: ["speed", "cost", "simple_tasks"],
  },
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    apiModel: "claude-3-5-sonnet-20241022",
    costPer1kTokens: 0.003,
    avgLatencyMs: 1500,
    maxContextTokens: 200000,
    strengths: ["long_documents", "creative_writing", "nuanced_analysis"],
  },
  "claude-3-5-haiku": {
    id: "claude-3-5-haiku",
    provider: "anthropic",
    apiModel: "claude-3-5-haiku-20241022",
    costPer1kTokens: 0.0008,
    avgLatencyMs: 400,
    maxContextTokens: 200000,
    strengths: ["speed", "cost", "simple_classification"],
  },
};

// Task to model mapping
const TASK_MODEL_MAP: Record<AITaskType, AIModel> = {
  simple_classification: "gpt-4o-mini",
  complex_reasoning: "gpt-4o",
  long_document: "claude-3-5-sonnet",
  structured_output: "gpt-4o",
  creative_writing: "claude-3-5-sonnet",
  sentiment_analysis: "gpt-4o-mini",
  summarization: "gpt-4o-mini",
  extraction: "gpt-4o",
};

export class ModelRouter {
  /**
   * Select the best model for a given task
   */
  select(taskType: AITaskType, options?: { forceModel?: AIModel; inputLength?: number }): ModelConfig {
    // If a specific model is forced, use it
    if (options?.forceModel) {
      return MODEL_CONFIGS[options.forceModel];
    }

    // For very long inputs, prefer Claude
    if (options?.inputLength && options.inputLength > 50000) {
      return MODEL_CONFIGS["claude-3-5-sonnet"];
    }

    // Use task mapping
    const selectedModel = TASK_MODEL_MAP[taskType] || "gpt-4o-mini";
    return MODEL_CONFIGS[selectedModel];
  }

  /**
   * Get model config
   */
  getConfig(model: AIModel): ModelConfig {
    return MODEL_CONFIGS[model];
  }

  /**
   * Execute with the selected model
   */
  async execute(
    model: ModelConfig,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: "text" | "json";
    }
  ): Promise<{ content: string; tokensUsed: number }> {
    const startTime = Date.now();

    if (model.provider === "openai") {
      return this.executeOpenAI(model, messages, options);
    } else {
      return this.executeAnthropic(model, messages, options);
    }
  }

  /**
   * Execute with OpenAI
   */
  private async executeOpenAI(
    model: ModelConfig,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: "text" | "json";
    }
  ): Promise<{ content: string; tokensUsed: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const body: any = {
      model: model.apiModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    };

    if (options?.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || "",
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  /**
   * Execute with Anthropic
   */
  private async executeAnthropic(
    model: ModelConfig,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: "text" | "json";
    }
  ): Promise<{ content: string; tokensUsed: number }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Extract system message
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.apiModel,
        max_tokens: options?.maxTokens ?? 2000,
        temperature: options?.temperature ?? 0.7,
        system: systemMessage,
        messages: userMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || "",
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  /**
   * Execute with retry and fallback
   */
  async executeWithFallback(
    taskType: AITaskType,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: "text" | "json";
      forceModel?: AIModel;
    }
  ): Promise<{ content: string; tokensUsed: number; model: AIModel }> {
    const primaryModel = this.select(taskType, { forceModel: options?.forceModel });

    try {
      const result = await this.execute(primaryModel, messages, options);
      return { ...result, model: primaryModel.id };
    } catch (error) {
      console.error(`[ModelRouter] Primary model ${primaryModel.id} failed:`, error);

      // Try fallback model
      const fallbackModel = primaryModel.provider === "openai"
        ? MODEL_CONFIGS["claude-3-5-sonnet"]
        : MODEL_CONFIGS["gpt-4o"];

      console.log(`[ModelRouter] Trying fallback model ${fallbackModel.id}`);
      const result = await this.execute(fallbackModel, messages, options);
      return { ...result, model: fallbackModel.id };
    }
  }
}

// Singleton instance
let modelRouter: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!modelRouter) {
    modelRouter = new ModelRouter();
  }
  return modelRouter;
}
