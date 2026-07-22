const STORAGE_KEY = "hexa-ai-state-v4";

const MODE_LABELS = {
  chat: "ChatGPT-like",
  reason: "Claude-like",
  search: "Perplexity-like",
  workflow: "Tool Workflow"
};

const MODE_HINTS = {
  chat: {
    system:
      "Reply with one exact, direct answer only. Keep it short and only give what is asked unless the user asks for details."
  },
  reason: {
    system:
      "Reply with one exact, direct answer only. If uncertain, state the missing detail and give the shortest possible correct answer."
  },
  search: {
    system:
      "Reply with one exact, direct answer only. Avoid process language and return a direct response."
  },
  workflow: {
    system:
      "Reply with one exact, direct answer only. State the result directly and only append assumptions if absolutely necessary."
  }
};

const PROVIDERS = {
  openai: {
    label: "OpenAI-compatible",
    supportsTools: true,
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-5", "gpt-4o", "gpt-4.1", "gpt-4o-mini", "hexa-1-mini", "hexa-1-pro"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  },
  chatgpt: {
    label: "ChatGPT",
    supportsTools: true,
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-5", "gpt-4o", "gpt-4.1", "gpt-4o-mini", "hexa-1-mini", "hexa-1-pro"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  },
  deepseek: {
    label: "DeepSeek-compatible",
    supportsTools: true,
    endpoint: "https://api.deepseek.com/chat/completions",
    models: ["deepseek-chat", "deepseek-reasoner"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  },
  groq: {
    label: "Groq",
    supportsTools: true,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.1-70b-versatile", "qwen/qwen-2.5-72b-instruct", "gemma2-9b-it", "meta-llama/llama-4-maverick-17b-128e-instruct"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  },
  xai: {
    label: "xAI Grok",
    supportsTools: true,
    endpoint: "https://api.x.ai/v1/chat/completions",
    models: ["grok-beta", "grok-vision-beta", "grok-2-1212"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  },
  anthropic: {
    label: "Anthropic-compatible",
    supportsTools: false,
    endpoint: "",
    models: ["claude-3-5-sonnet-20240620", "claude-3-haiku-20240307", "hexa-thinking"],
    headers: (key) => ({
      "x-api-key": key || "",
      "anthropic-version": "2023-06-01"
    })
  },
  claude: {
    label: "Claude",
    supportsTools: false,
    endpoint: "",
    models: ["claude-3-5-sonnet-20240620", "claude-3-haiku-20240307", "hexa-thinking"],
    headers: (key) => ({
      "x-api-key": key || "",
      "anthropic-version": "2023-06-01"
    })
  },
  google: {
    label: "Google Gemini-compatible",
    supportsTools: false,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro-latest"],
    headers: (key) => (key ? { "x-goog-api-key": key } : {})
  },
  perplexity: {
    label: "Perplexity-style",
    supportsTools: false,
    endpoint: "",
    models: ["pplx-70b-online", "llama-3.1-sonar-small-128k-chat", "llama-3.1-sonar-large-128k-chat"],
    headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {})
  }
};

const MODE_TO_PROVIDER = {
  chat: ["openai", "chatgpt", "groq", "deepseek", "xai", "google", "perplexity", "anthropic", "claude"],
  reason: ["anthropic", "claude", "openai", "chatgpt", "deepseek", "perplexity", "groq", "google", "xai"],
  search: ["perplexity", "google", "openai", "chatgpt", "deepseek", "groq", "anthropic", "claude", "xai"],
  workflow: ["openai", "chatgpt", "groq", "deepseek", "xai", "google", "perplexity", "anthropic", "claude"]
};

const LOCAL_TOOL_DEFINITIONS = [
  {
    name: "base64",
    description: "Encode or decode base64 text.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Choose encode or decode."
        },
        value: {
          type: "string",
          description: "Text to process."
        }
      },
      required: ["action", "value"]
    },
    run: (args) => {
      const action = String(args?.action || "").toLowerCase();
      const value = String(args?.value || "");
      if (!["encode", "decode"].includes(action)) {
        return { success: false, output: "Action must be 'encode' or 'decode'." };
      }
      if (!value.trim()) {
        return { success: false, output: "No value provided." };
      }
      try {
        if (action === "encode") {
          return { success: true, output: btoa(unescape(encodeURIComponent(value))) };
        }
        return { success: true, output: decodeURIComponent(escape(atob(value))) };
      } catch {
        return { success: false, output: `Could not ${action} base64 value.` };
      }
    }
  },
  {
    name: "website_fetch",
    description: "Fetch a public webpage and extract structured signals (title, description, headings, links, and readable snippet).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The absolute URL to process."
        },
        maxChars: {
          type: "number",
          description: "Maximum number of text characters to include in the snippet.",
          minimum: 250,
          maximum: 6000,
          default: 1800
        },
        useCorsProxy: {
          type: "boolean",
          description: "Attempt a CORS proxy when direct browser fetch fails."
        }
      },
      required: ["url"]
    },
    run: async (args) => {
      const raw = typeof args === "string" ? { url: args } : args || {};
      const urlInput = String(raw.url || "").trim();
      if (!urlInput) {
        return { success: false, output: "No URL provided." };
      }

      let targetUrl;
      try {
        const parsed = new URL(urlInput);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return { success: false, output: "Only http/https URLs are supported." };
        }
        targetUrl = parsed.toString();
      } catch {
        return { success: false, output: `Invalid URL: ${urlInput}` };
      }

      const maxChars = Math.max(250, Math.min(6000, Number(raw.maxChars || 1800)));
      const useCorsProxy = !!raw.useCorsProxy;
      const origin = new URL(targetUrl);
      const endpoints = [
        { url: targetUrl, mode: "cors" }
      ];

      if (useCorsProxy) {
        endpoints.unshift({
          url: `https://r.jina.ai/http://` + origin.host + origin.pathname + origin.search,
          mode: "cors"
        });
      }

      let lastErr = "No response returned.";
      let fetchedFrom = "";
      let responseText = "";
      let finalResponse = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint.url, {
            method: "GET",
            redirect: "follow",
            headers: {
              Accept: "text/html, text/plain, */*;q=0.8"
            },
            credentials: "omit"
          });

          if (!response) {
            lastErr = "No response object.";
            continue;
          }
          if (!response.ok) {
            lastErr = `HTTP ${response.status} ${response.statusText} (${endpoint.url})`;
            continue;
          }

          finalResponse = response;
          fetchedFrom = endpoint.url;
          responseText = await response.text();
          break;
        } catch (error) {
          lastErr = error?.message || String(error);
        }
      }

      if (!finalResponse || !responseText) {
        return {
          success: false,
          output: `Could not fetch ${targetUrl}. ${lastErr} ${useCorsProxy ? "Try another source website." : "Try retrying with {\"url\": \"...\", \"useCorsProxy\": true}."}`
        };
      }

      const parser = new DOMParser();
      const document = parser.parseFromString(responseText, "text/html");
      const bodyText = (document.body?.textContent || "").replace(/\s+/g, " ").trim();
      const h1 = [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim()).filter(Boolean);
      const h2 = [...document.querySelectorAll("h2")].map((node) => node.textContent?.trim()).filter(Boolean);
      const title = document.querySelector("title")?.textContent?.trim() || "";
      const description =
        document.querySelector("meta[name='description']")?.getAttribute("content")?.trim() ||
        document.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() ||
        "";

      const anchorNodes = [...document.querySelectorAll("a[href]")];
      const links = anchorNodes
        .map((anchor) => String(anchor.getAttribute("href") || "").trim())
        .filter(Boolean);
      const externalLinks = links.filter((link) => {
        try {
          return new URL(link, targetUrl).hostname !== origin.hostname;
        } catch {
          return false;
        }
      }).length;
      const uniqueLinks = [...new Set(links)].length;

      const output = {
        url: targetUrl,
        fetchedFrom,
        status: finalResponse.status,
        title,
        description,
        headings: {
          h1: h1.length,
          h2: h2.length
        },
        first_h1: h1[0] || "",
        first_h2: h2[0] || "",
        structure: {
          links: links.length,
          uniqueLinks,
          externalLinks,
          scriptCount: document.querySelectorAll("script").length,
          imageCount: document.querySelectorAll("img").length
        },
        words: bodyText ? bodyText.split(/\s+/).length : 0,
        snippet: bodyText.slice(0, maxChars)
      };

      return {
        success: true,
        output: JSON.stringify(output, null, 2)
      };
    }
  },
  {
    name: "calculator",
    description: "Execute a numeric expression.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression, e.g. '12 * (15 + 4) / 2'."
        }
      },
      required: ["expression"]
    },
    run: (args) => {
      const expression = typeof args === "string" ? args : String(args?.expression || "");
      if (!expression.trim()) return { success: false, output: "No expression provided." };

      if (!/^[0-9+\-*/().^%\s]+$/.test(expression.trim())) {
        return { success: false, output: "Unsafe expression. Use only digits and + - * / ( ) . % ^ operators." };
      }

      try {
        const normalized = expression.replace(/\^/g, "**");
        const evaluated = Function(`"use strict"; return (${normalized})`)();
        if (!Number.isFinite(evaluated)) {
          return { success: false, output: "Expression did not produce a finite number." };
        }
        return { success: true, output: `${expression} = ${evaluated}` };
      } catch {
        return { success: false, output: "Could not evaluate expression." };
      }
    }
  },
  {
    name: "json_formatter",
    description: "Validate and pretty print JSON.",
    parameters: {
      type: "object",
      properties: {
        payload: {
          type: "string",
          description: "Any JSON string to format."
        }
      },
      required: ["payload"]
    },
    run: (args) => {
      try {
        const raw = typeof args === "string" ? args : String(args?.payload || "");
        const parsed = JSON.parse(raw);
        return { success: true, output: JSON.stringify(parsed, null, 2) };
      } catch {
        return { success: false, output: "Invalid JSON payload." };
      }
    }
  },
  {
    name: "timestamp",
    description: "Return current UTC timestamp and local formatted time.",
    parameters: {
      type: "object",
      properties: {}
    },
    run: () => {
      const now = new Date();
      return {
        success: true,
        output: JSON.stringify({
          iso: now.toISOString(),
          unix_ms: now.getTime(),
          local: now.toLocaleString()
        }, null, 2)
      };
    }
  },
  {
    name: "text_stats",
    description: "Count words, characters, letters, lines, and sentence boundaries.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Input text to analyze."
        }
      },
      required: ["text"]
    },
    run: (args) => {
      const text = String(args?.text || "");
      const trimmed = text.trim();
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      const lines = text ? text.split("\n").length : 0;
      const chars = text.length;
      const letters = (text.match(/[A-Za-z]/g) || []).length;
      const sentences = trimmed ? (trimmed.split(/[.!?]+/).filter(Boolean).length || 1) : 0;
      return {
        success: true,
        output: JSON.stringify({ words, lines, chars, letters, sentences }, null, 2)
      };
    }
  },
  {
    name: "regex_find",
    description: "Find matches for a regex pattern inside text.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to search."
        },
        pattern: {
          type: "string",
          description: "ECMAScript regex pattern."
        },
        flags: {
          type: "string",
          description: "Optional regex flags."
        }
      },
      required: ["text", "pattern"]
    },
    run: (args) => {
      const text = String(args?.text || "");
      const pattern = String(args?.pattern || "").trim();
      const flags = String(args?.flags || "g");

      if (!pattern) {
        return { success: false, output: "No regex pattern provided." };
      }
      if (!text) {
        return { success: false, output: "No text provided." };
      }

      try {
        const safeFlags = flags.includes("g") ? flags : `${flags}g`;
        const regex = new RegExp(pattern, safeFlags);
        const matches = [...text.matchAll(regex)].map((match) => match[0]);
        return {
          success: true,
          output: matches.length ? JSON.stringify(matches, null, 2) : "No matches found."
        };
      } catch {
        return { success: false, output: "Invalid regex pattern or flags." };
      }
    }
  },
  {
    name: "uuid",
    description: "Generate a UUID-like unique identifier.",
    parameters: {
      type: "object",
      properties: {}
    },
    run: () => {
      const s = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return { success: true, output: s };
    }
  },
  {
    name: "slugify",
    description: "Turn text into URL-safe slug.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Input text to convert."
        }
      },
      required: ["text"]
    },
    run: (args) => {
      const input = typeof args === "string" ? args : String(args?.text || "");
      if (!input.trim()) {
        return { success: false, output: "No text provided." };
      }
      const slug = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return { success: true, output: slug };
    }
  }
];

const LOCAL_TOOL_BY_NAME = Object.fromEntries(LOCAL_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

const OPENAI_TOOL_SCHEMA = LOCAL_TOOL_DEFINITIONS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

function sanitizeToolName(raw) {
  const safe = String(raw || "").trim().toLowerCase();
  return safe.replace(/[^a-z0-9_-]/g, "");
}

function parseToolInvocation(rawText) {
  const clean = String(rawText || "").trim();
  const match = clean.match(/^\/tool\s+([a-zA-Z0-9_-]+)\s*([\s\S]*)$/i);
  if (!match) return null;
  return {
    name: sanitizeToolName(match[1]),
    rawArgs: (match[2] || "").trim()
  };
}

function splitWorkflowInput(rawText) {
  const input = String(rawText || "").trim();
  if (!input) return [];

  const chunks = [];
  let cursor = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = 0; i <= input.length; i += 1) {
    const char = input[i] || "";

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]" || char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if ((char === "\n" || char === ";" || i === input.length) && depth === 0) {
      const token = input.slice(cursor, i).trim();
      if (token) chunks.push(token);
      cursor = i + 1;
    }
  }

  if (!chunks.length && input.trim()) {
    chunks.push(input.trim());
  }
  return chunks;
}

async function runLocalTool(name, rawArgs) {
  const tool = LOCAL_TOOL_BY_NAME[sanitizeToolName(name)];
  if (!tool) return { success: false, output: `Unknown tool: ${name}` };

  let args = rawArgs;
  if (rawArgs && typeof rawArgs === "string" && rawArgs.trim().startsWith("{")) {
    try {
      args = JSON.parse(rawArgs.trim());
    } catch {
      args = rawArgs.trim();
    }
  } else if (typeof rawArgs === "string" && /[:=]/.test(rawArgs)) {
    const segments = rawArgs
      .match(/(?:[^\s"]+|"[^"]*"|'[^']*')+/g)
      ?.map((token) => token.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean) || [];

    const kvArgs = {};
    for (const segment of segments) {
      const eq = segment.indexOf("=");
      const colon = segment.indexOf(":");
      const delimiter =
        eq > 0 && (colon < 0 || eq < colon)
          ? eq
          : colon > 0
            ? colon
            : -1;

      if (delimiter > 0) {
        const key = segment.slice(0, delimiter).trim();
        const value = segment.slice(delimiter + 1).trim().replace(/^["']|["']$/g, "");
        if (key) {
          kvArgs[key] = value;
        }
      }
    }
    if (Object.keys(kvArgs).length) {
      args = kvArgs;
    }
  } else if (!rawArgs && tool.parameters.required?.length) {
    return { success: false, output: `Tool ${name} needs argument(s).` };
  }

  if (tool.parameters.required?.includes("expression") && typeof args === "string") {
    args = { expression: args };
  }
  if (tool.parameters.required?.includes("payload") && typeof args === "string") {
    args = { payload: args };
  }
  if (tool.parameters.required?.includes("text") && typeof args === "string") {
    args = { text: args };
  }
  if (tool.parameters.required?.includes("action") && tool.parameters.required?.includes("value")) {
    if (typeof args === "string") {
      const [action, ...valueParts] = args.split(" ");
      if (action && valueParts.length) {
        args = {
          action: action.trim(),
          value: valueParts.join(" ").trim()
        };
      }
    }
    if (args && typeof args === "object" && (typeof args.action !== "string" || typeof args.value !== "string")) {
      return { success: false, output: "Invalid base64 arguments. Use {\"action\":\"encode|decode\",\"value\":\"...\"}." };
    }
  }

  return await Promise.resolve(tool.run(args));
}

function parseWorkflowCommands(rawText) {
  const lines = splitWorkflowInput(rawText);
  if (!lines.length) return [];

  const commands = [];

  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate) continue;

    if (/^\/workflow\b/i.test(candidate)) {
      const workflowText = candidate.replace(/^\/workflow\b/i, "").trim();
      if (!workflowText) continue;
      const nested = parseWorkflowCommands(workflowText);
      if (nested.length) {
        commands.push(...nested);
      }
      continue;
    }

    if (/^\/tool\s+/i.test(candidate)) {
      const explicit = parseToolInvocation(candidate);
      if (explicit?.name) {
        commands.push({ ...explicit });
      }
      continue;
    }

    const match = candidate.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*([\s\S]*)$/);
    if (!match) continue;

    const name = sanitizeToolName(match[1]);
    if (!LOCAL_TOOL_BY_NAME[name]) {
      commands.push({
        name,
        rawArgs: (match[2] || "").trim(),
        parseError: `Unknown tool: ${name}`
      });
      continue;
    }
    commands.push({
      name,
      rawArgs: (match[2] || "").trim()
    });
  }

  return commands;
}

async function runLocalWorkflowFromPrompt(rawText) {
  const commands = parseWorkflowCommands(rawText);
  if (!commands.length) {
    return null;
  }

  const runs = [];
  for (const command of commands) {
    if (command.parseError) {
      runs.push({
        name: command.name,
        status: "error",
        output: command.parseError,
        args: command.rawArgs || ""
      });
      continue;
    }

    const result = await hydrateToolExecution(command.name, command.rawArgs);
    runs.push({
      ...result,
      name: command.name,
      input: command.rawArgs
    });
  }

  const outputText = runs
    .map(
      (run, index) =>
        `Step ${index + 1}: ${run.name} (${run.status})\nInput: ${run.args ? (typeof run.args === "string" ? run.args : JSON.stringify(run.args)) : "none"}\n${run.output || "No output."}`
    )
    .join("\n\n");

  return {
    content: outputText,
    metadata: {
      tools: runs,
      workflow: {
        steps: runs.length,
        succeeded: runs.filter((step) => step.status === "ok").length
      },
      toolMode: "manual-workflow"
    }
  };
}

function normalizeToolCallArguments(rawArguments) {
  if (typeof rawArguments === "string") {
    try {
      return JSON.parse(rawArguments);
    } catch {
      return rawArguments;
    }
  }
  return rawArguments || {};
}

async function hydrateToolExecution(toolName, rawArguments) {
  const callArgs = normalizeToolCallArguments(rawArguments);
  const result = await runLocalTool(toolName, callArgs);
  return {
    name: sanitizeToolName(toolName),
    status: result.success ? "ok" : "error",
    output: result.output || "",
    args: callArgs
  };
}

function normalizeToolCall(call, fallbackIndex = 0) {
  const fn = call?.function || {};
  const name = sanitizeToolName(fn?.name || call?.name || "");
  if (!name) {
    return null;
  }

  return {
    id: call?.id || `${name}-${fallbackIndex}`,
    name,
    args: normalizeToolCallArguments(fn?.arguments || call?.arguments)
  };
}

function appendToolMessagesToHistory(history, toolRuns) {
  for (const run of toolRuns) {
    history.push({
      role: "tool",
      name: run.name,
      tool_call_id: run.id || `${run.name}-${history.length}`,
      content: JSON.stringify(
        {
          status: run.status,
          output: run.output || ""
        },
        null,
        2
      )
    });
  }
}

const PROMPT_TEMPLATES = {
  chat: [
    "Draft a clean PRD summary for this feature in 7 bullets.",
    "Turn this into production-grade pseudo-code and a quick architecture note.",
    "Write a concise email reply and a more formal version.",
    "Give me a step-by-step debug checklist for this issue."
  ],
  reason: [
    "Define the decision matrix for this architecture choice with trade-offs.",
    "Break this requirement into milestones with success criteria.",
    "List hidden assumptions, failure modes, and fallback plans.",
    "Write a quality gate checklist for this change."
  ],
  search: [
    "Give me an evidence-backed summary of latest changes in this topic.",
    "Compare 3 approaches and cite source classes.",
    "Provide a practical implementation recommendation after evidence review.",
    "List what to verify before presenting this result to leadership."
  ],
  workflow: [
    "/tool calculator 18 * 12",
    "/tool website_fetch {\"url\":\"https://example.com\",\"useCorsProxy\":true,\"maxChars\":1200}",
    "/tool json_formatter {\"payload\":\"{\\\"name\\\": \\\"Hexa AI\\\", \\\"year\\\": 2026}\"}",
    "/tool timestamp",
    "/tool slugify Build a world-class AI workflow",
    "/tool text_stats Hexa AI executes chained local tools then summarizes in concise output.",
    "/workflow calculator 2 + 2; regex_find {\"pattern\":\"\\\\d+\",\"text\":\"24 hours and 7 minutes\"}"
  ]
};

const STATUS_INTERVAL_MS = 12000;
const state = {
  conversations: [],
  activeConversationId: null,
  settings: {
    memory: "",
    mode: "chat",
    provider: "openai",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 12000,
    retryCount: 2,
    endpoint: "",
    apiKey: "",
    searchEndpoint: "",
    searchApiKey: "",
    providers: {
      openai: {
        endpoint: "",
        apiKey: "",
        model: "hexa-1-mini"
      },
      chatgpt: {
        endpoint: "",
        apiKey: "",
        model: "gpt-4o"
      },
      deepseek: {
        endpoint: "",
        apiKey: "",
        model: "deepseek-chat"
      },
      groq: {
        endpoint: "",
        apiKey: "",
        model: "llama-3.1-70b-versatile"
      },
      xai: {
        endpoint: "",
        apiKey: "",
        model: "grok-2-1212"
      },
      anthropic: {
        endpoint: "",
        apiKey: "",
        model: "claude-3-5-sonnet-20240620"
      },
      claude: {
        endpoint: "",
        apiKey: "",
        model: "claude-3-5-sonnet-20240620"
      },
      google: {
        endpoint: "",
        apiKey: "",
        model: "gemini-2.5-flash"
      },
      perplexity: {
        endpoint: "",
        apiKey: "",
        model: "pplx-70b-online"
      }
    },
    enableTools: false
  },
  isGenerating: false,
  stopRequested: false,
  streamHandle: null
};

const refs = {
  conversationList: document.getElementById("conversationList"),
  searchInput: document.getElementById("conversationSearch"),
  newChatButton: document.getElementById("newChat"),
  exportButton: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  themeToggle: document.getElementById("themeToggle"),
  chatTitle: document.getElementById("chatTitle"),
  chatMeta: document.getElementById("chatMeta"),
  modelSelect: document.getElementById("modelSelect"),
  providerSelect: document.getElementById("providerSelect"),
  modeSelect: document.getElementById("modeSelect"),
  templateSelect: document.getElementById("templateSelect"),
  insertTemplate: document.getElementById("insertTemplate"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsDialog: document.getElementById("settingsDialog"),
  providerConfig: document.getElementById("providerConfig"),
  apiEndpoint: document.getElementById("apiEndpoint"),
  apiKey: document.getElementById("apiKey"),
  searchEndpoint: document.getElementById("searchEndpoint"),
  searchApiKey: document.getElementById("searchApiKey"),
  enableTools: document.getElementById("enableTools"),
  temperature: document.getElementById("temperature"),
  tempLabel: document.getElementById("tempLabel"),
  maxTokens: document.getElementById("maxTokens"),
  maxLabel: document.getElementById("maxLabel"),
  timeoutMs: document.getElementById("timeoutMs"),
  timeoutLabel: document.getElementById("timeoutLabel"),
  retryCount: document.getElementById("retryCount"),
  retryLabel: document.getElementById("retryLabel"),
  saveSettings: document.getElementById("saveSettings"),
  chatLog: document.getElementById("chatLog"),
  messageInput: document.getElementById("messageInput"),
  sendButton: document.getElementById("sendBtn"),
  stopButton: document.getElementById("stopBtn"),
  fileInput: document.getElementById("fileInput"),
  attachments: document.getElementById("attachments"),
  memoryInput: document.getElementById("memoryInput"),
  saveMemory: document.getElementById("saveMemory"),
  clearMemory: document.getElementById("clearMemory")
};

const starterByMode = {
  chat: "Hi, I’m Hexa. I can help with coding, documentation, and product planning. Ask me anything.",
  reason: "Hi, I’m Hexa Reason. I can break down complex tasks, assumptions, and implementation paths in steps.",
  search: "Hi, I’m Hexa Search. Share a topic and I’ll return a short evidence-led answer with references and checks.",
  workflow: "Hi, I’m Hexa Workflow. Use tool chains like `/tool calculator 2+2` or `/workflow calculator 2+2; slugify launch-notes`."
    + " You can also run `/tool website_fetch {\"url\":\"https://example.com\",\"useCorsProxy\":true}`."
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let pendingAttachments = [];

function normalizeMode(raw) {
  return raw === "reason" || raw === "search" || raw === "chat" || raw === "workflow" ? raw : "chat";
}

function normalizeProvider(raw) {
  return Object.keys(PROVIDERS).includes(raw) ? raw : "openai";
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function makeModeLabel(mode) {
  return MODE_LABELS[mode] || "General";
}

function currentConversation() {
  return state.conversations.find((c) => c.id === state.activeConversationId) || null;
}

function currentMode() {
  return normalizeMode(state.settings.mode || "chat");
}

function currentProvider() {
  return normalizeProvider(state.settings.provider || "openai");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderMarkdown(input = "") {
  const safe = escapeHtml(String(input));
  const fenced = safe.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.replaceAll("\n", "<br>")}</code></pre>`;
  });
  return fenced
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function updateThemeButton() {
  refs.themeToggle.textContent = document.body.classList.contains("dark") ? "Light mode" : "Dark mode";
}

function applyThemeFromStorage() {
  const savedTheme = localStorage.getItem("hexa-ai-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }
  updateThemeButton();
}

function persistTheme() {
  localStorage.setItem("hexa-ai-theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncProvidersFromLegacySettings(parsed) {
  const legacyEndpoint = parsed?.settings?.endpoint || "";
  const legacyKey = parsed?.settings?.apiKey || "";

  if (!legacyEndpoint && !legacyKey) return;

  state.settings.providers.openai.endpoint = state.settings.providers.openai.endpoint || legacyEndpoint;
  state.settings.providers.openai.apiKey = state.settings.providers.openai.apiKey || legacyKey;

  if (!state.settings.endpoint) {
    state.settings.endpoint = legacyEndpoint;
  }
  if (!state.settings.apiKey) {
    state.settings.apiKey = legacyKey;
  }
}

function getDefaultProviders() {
  return {
  openai: {
    endpoint: PROVIDERS.openai.endpoint || "",
    apiKey: "",
    model: PROVIDERS.openai.models[0]
  },
  chatgpt: {
    endpoint: PROVIDERS.chatgpt.endpoint || "",
    apiKey: "",
    model: PROVIDERS.chatgpt.models[0]
  },
  deepseek: {
    endpoint: PROVIDERS.deepseek.endpoint || "",
    apiKey: "",
    model: PROVIDERS.deepseek.models[0]
  },
  groq: {
    endpoint: PROVIDERS.groq.endpoint || "",
    apiKey: "",
    model: PROVIDERS.groq.models[0]
  },
  xai: {
    endpoint: PROVIDERS.xai.endpoint || "",
    apiKey: "",
    model: PROVIDERS.xai.models[0]
  },
  anthropic: {
    endpoint: PROVIDERS.anthropic.endpoint || "",
    apiKey: "",
    model: PROVIDERS.anthropic.models[0]
  },
  claude: {
    endpoint: PROVIDERS.claude.endpoint || "",
    apiKey: "",
    model: PROVIDERS.claude.models[0]
  },
  google: {
      endpoint: PROVIDERS.google.endpoint || "",
      apiKey: "",
      model: PROVIDERS.google.models[0]
    },
    perplexity: {
      endpoint: PROVIDERS.perplexity.endpoint || "",
      apiKey: "",
      model: PROVIDERS.perplexity.models[0]
    }
  };
}

function getProviderOptions() {
  return Object.entries(PROVIDERS).map(([value, details]) => ({ value, label: details.label }));
}

function getProviderConfig(provider) {
  const normalized = normalizeProvider(provider);
  return state.settings.providers[normalized] || {
    endpoint: "",
    apiKey: "",
    model: PROVIDERS[normalized]?.models?.[0] || ""
  };
}

function getActiveModel(provider, fallback) {
  const config = getProviderConfig(provider);
  const providerModels = PROVIDERS[provider]?.models || [];
  if (providerModels.includes(config.model)) {
    return config.model;
  }
  return fallback || providerModels[0] || "";
}

function populateModelOptions(provider) {
  refs.modelSelect.innerHTML = "";

  const models = PROVIDERS[provider]?.models || ["model"];
  for (const value of models) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    refs.modelSelect.appendChild(opt);
  }

  const active = getActiveModel(provider, models[0]);
  refs.modelSelect.value = active;
  state.settings.providers[provider] = {
    ...getProviderConfig(provider),
    model: active
  };
}

function populateProviderSelects() {
  refs.providerSelect.innerHTML = "";
  refs.providerConfig.innerHTML = "";

  for (const { value, label } of getProviderOptions()) {
    const inTop = document.createElement("option");
    inTop.value = value;
    inTop.textContent = label;

    const inSettings = document.createElement("option");
    inSettings.value = value;
    inSettings.textContent = label;

    refs.providerSelect.appendChild(inTop);
    refs.providerConfig.appendChild(inSettings);
  }

  refs.providerSelect.value = state.settings.provider;
  refs.providerConfig.value = state.settings.provider;
}

function buildTemplateChoices(mode) {
  refs.templateSelect.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select template";
  refs.templateSelect.appendChild(defaultOpt);

  const templates = PROMPT_TEMPLATES[mode] || [];
  for (const templateText of templates) {
    const option = document.createElement("option");
    option.value = templateText;
    option.textContent = templateText.length > 65 ? `${templateText.slice(0, 62)}…` : templateText;
    option.title = templateText;
    refs.templateSelect.appendChild(option);
  }
}

function refreshMemoryInputs(conv) {
  refs.memoryInput.value = conv?.notes || state.settings.memory || "";
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.settings.mode = "chat";
    state.settings.provider = "openai";
    createConversation();
    return;
  }

  const parsed = JSON.parse(saved);
  state.conversations = parsed.conversations || [];
  state.activeConversationId = parsed.activeConversationId || null;
  state.settings = {
    ...state.settings,
    ...(parsed.settings || {}),
    mode: normalizeMode(parsed.settings?.mode),
    provider: normalizeProvider(parsed.settings?.provider)
  };

  if (!state.settings.providers) {
    state.settings.providers = getDefaultProviders();
  } else {
    state.settings.providers = {
      ...getDefaultProviders(),
      ...state.settings.providers,
      openai: { ...getDefaultProviders().openai, ...(state.settings.providers.openai || {}) },
      chatgpt: { ...getDefaultProviders().chatgpt, ...(state.settings.providers.chatgpt || {}) },
      deepseek: { ...getDefaultProviders().deepseek, ...(state.settings.providers.deepseek || {}) },
      groq: { ...getDefaultProviders().groq, ...(state.settings.providers.groq || {}) },
      xai: { ...getDefaultProviders().xai, ...(state.settings.providers.xai || {}) },
      anthropic: { ...getDefaultProviders().anthropic, ...(state.settings.providers.anthropic || {}) },
      claude: { ...getDefaultProviders().claude, ...(state.settings.providers.claude || {}) },
      google: { ...getDefaultProviders().google, ...(state.settings.providers.google || {}) },
      perplexity: { ...getDefaultProviders().perplexity, ...(state.settings.providers.perplexity || {}) }
    };
  }

  if (typeof state.settings.enableTools !== "boolean") {
    state.settings.enableTools = false;
  }

  syncProvidersFromLegacySettings(parsed);

  if (!state.conversations.length) {
    createConversation(false);
  } else if (!state.activeConversationId || !state.conversations.find((c) => c.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[0].id;
  }

  populateProviderSelects();
  populateModelOptions(state.settings.provider);
  buildTemplateChoices(state.settings.mode || "chat");

  refs.modelSelect.value = getActiveModel(state.settings.provider, PROVIDERS[state.settings.provider]?.models?.[0]);
  refs.modeSelect.value = state.settings.mode || "chat";
  refs.providerSelect.value = state.settings.provider;
  refs.providerConfig.value = state.settings.provider;

  refs.apiEndpoint.value = getProviderConfig(state.settings.provider).endpoint || "";
  refs.apiKey.value = getProviderConfig(state.settings.provider).apiKey || "";
  refs.searchEndpoint.value = state.settings.searchEndpoint || "";
  refs.searchApiKey.value = state.settings.searchApiKey || "";
  refs.enableTools.checked = state.settings.enableTools || false;

  refs.temperature.value = state.settings.temperature || 0.6;
  refs.tempLabel.textContent = state.settings.temperature || 0.6;
  refs.maxTokens.value = state.settings.maxTokens || 1024;
  refs.maxLabel.textContent = state.settings.maxTokens || 1024;
  refs.timeoutMs.value = state.settings.timeoutMs || 12000;
  refs.timeoutLabel.textContent = state.settings.timeoutMs || 12000;
  refs.retryCount.value = state.settings.retryCount || 2;
  refs.retryLabel.textContent = state.settings.retryCount || 2;

  applyThemeFromStorage();
  renderAll();
}

function createConversation(shouldRender = true) {
  const mode = currentMode();
  const provider = currentProvider();

  const newConversation = {
    id: makeId(),
    title: "New chat",
    createdAt: Date.now(),
    mode,
    provider,
    notes: state.settings.memory || "",
    messages: [
      {
        id: makeId(),
        role: "assistant",
        content: starterByMode[mode] || starterByMode.chat,
        createdAt: Date.now(),
        metadata: {
          mode,
          provider
        }
      }
    ]
  };

  state.conversations.unshift(newConversation);
  state.activeConversationId = newConversation.id;
  refreshMemoryInputs(newConversation);
  saveState();
  if (shouldRender) {
    buildTemplateChoices(mode);
    renderAll();
  }
}

function updateConversationTitle(conv, firstUserMessage) {
  if (!conv || !firstUserMessage) return;
  const text = firstUserMessage.split("[Attached files]")[0].trim().replace(/\s+/g, " ");
  conv.title = text.slice(0, 40) + (text.length > 40 ? "…" : "");
}

function renderConversations() {
  const query = refs.searchInput.value.trim().toLowerCase();
  refs.conversationList.innerHTML = "";

  const filtered = state.conversations.filter((conv) => {
    if (!query) return true;
    return (
      conv.title.toLowerCase().includes(query) ||
      conv.messages.some((message) => String(message.content || "").toLowerCase().includes(query))
    );
  });

  for (const conv of filtered) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `conv-item ${conv.id === state.activeConversationId ? "active" : ""}`;

    const row = document.createElement("div");
    row.className = "row";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = conv.title;
    title.title = conv.title;

    const actions = document.createElement("div");

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "btn secondary";
    rename.textContent = "✎";
    rename.title = "Rename";
    rename.onclick = (event) => {
      event.stopPropagation();
      const newTitle = prompt("Rename chat", conv.title);
      if (!newTitle) return;
      conv.title = newTitle.trim().slice(0, 60);
      saveState();
      renderAll();
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn danger";
    remove.textContent = "×";
    remove.title = "Delete";
    remove.onclick = (event) => {
      event.stopPropagation();
      if (!confirm("Delete this conversation?")) return;
      const idx = state.conversations.findIndex((x) => x.id === conv.id);
      if (idx >= 0) {
        state.conversations.splice(idx, 1);
      }
      if (state.activeConversationId === conv.id) {
        state.activeConversationId = state.conversations[0]?.id || null;
      }
      if (!state.activeConversationId) {
        createConversation(false);
      }
      saveState();
      renderAll();
    };

    actions.appendChild(rename);
    actions.appendChild(remove);

    const modeLabel = document.createElement("div");
    modeLabel.className = "meta";
    const provider = conv.provider || currentProvider();
    modeLabel.textContent = `${makeModeLabel(conv.mode || "chat")} • ${provider.toUpperCase()}`;

    const stats = document.createElement("div");
    stats.className = "muted";
    stats.textContent = `${conv.messages.length} messages • ${new Date(conv.createdAt).toLocaleDateString()}`;

    row.appendChild(title);
    row.appendChild(actions);

    node.appendChild(row);
    node.appendChild(modeLabel);
    node.appendChild(stats);

    node.onclick = () => {
      state.activeConversationId = conv.id;
      state.settings.mode = normalizeMode(conv.mode || "chat");
      state.settings.provider = normalizeProvider(conv.provider || currentProvider());
      refs.modeSelect.value = state.settings.mode;
      refs.providerSelect.value = state.settings.provider;
      refs.providerConfig.value = state.settings.provider;
      const config = getProviderConfig(state.settings.provider);
      refs.apiEndpoint.value = config.endpoint || "";
      refs.apiKey.value = config.apiKey || "";
      populateModelOptions(state.settings.provider);
      buildTemplateChoices(state.settings.mode);
      refreshMemoryInputs(conv);
      refs.modelSelect.value = getActiveModel(state.settings.provider, config.model);
      renderAll();
    };

    refs.conversationList.appendChild(node);
  }
}

function parseSources(rawSources) {
  if (!Array.isArray(rawSources)) return [];

  return rawSources
    .map((source) => {
      if (typeof source === "string") {
        return { title: source, url: source, snippet: "" };
      }
      if (typeof source === "object" && source !== null) {
        return {
          title: source.title || source.url || "Source",
          url: source.url || source.link || "#",
          snippet: source.snippet || source.extract || source.title || ""
        };
      }
      return null;
    })
    .filter(Boolean);
}

function createSourceCards(sources, container) {
  if (!sources.length) return;

  const sourceCard = document.createElement("div");
  sourceCard.className = "sources";

  const heading = document.createElement("h4");
  heading.textContent = "Sources";
  sourceCard.appendChild(heading);

  const list = document.createElement("ul");
  for (const source of sources.slice(0, 6)) {
    const li = document.createElement("li");
    li.className = "sources-card";

    const link = document.createElement("a");
    link.href = source.url || "#";
    link.textContent = source.title;
    link.target = "_blank";
    link.rel = "noopener";
    li.appendChild(link);

    if (source.snippet) {
      const text = document.createElement("div");
      text.className = "sources-snippet";
      text.textContent = source.snippet;
      li.appendChild(text);
    }

    list.appendChild(li);
  }

  sourceCard.appendChild(list);
  container.appendChild(sourceCard);
}

function renderMessageMeta(msgMeta, container) {
  if (!msgMeta || typeof msgMeta !== "object") return;

  if (Array.isArray(msgMeta.process) && msgMeta.process.length) {
    const processCard = document.createElement("div");
    processCard.className = "process";

    const heading = document.createElement("h4");
    heading.textContent = "Reasoning process";
    processCard.appendChild(heading);

    const list = document.createElement("ol");
    for (const step of msgMeta.process) {
      const item = document.createElement("li");
      item.textContent = String(step);
      list.appendChild(item);
    }
    processCard.appendChild(list);
    container.appendChild(processCard);
  }

  if (Array.isArray(msgMeta.tools) && msgMeta.tools.length) {
    const toolCard = document.createElement("div");
    toolCard.className = "process";

    const heading = document.createElement("h4");
    heading.textContent = msgMeta.toolMode === "manual" || msgMeta.toolMode === "manual-workflow"
      ? "Tool execution"
      : "Executed tools";
    toolCard.appendChild(heading);

    const list = document.createElement("ul");
    for (const tool of msgMeta.tools) {
      const item = document.createElement("li");
      const argsText = tool.args ? ` | args: ${typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args)}` : "";
      const roundText = tool.round ? ` · round ${tool.round}` : "";
      item.textContent = `${tool.name} (${tool.status})${roundText}${argsText}\n${tool.output || "No output."}`;
      list.appendChild(item);
    }
    toolCard.appendChild(list);
    container.appendChild(toolCard);
  }

  if (typeof msgMeta.confidence === "number") {
    const conf = document.createElement("div");
    conf.className = "meta";
    conf.textContent = `Confidence: ${Math.round(msgMeta.confidence * 100)}%`;
    container.appendChild(conf);
  }

  if (Array.isArray(msgMeta.sources) && msgMeta.sources.length) {
    createSourceCards(msgMeta.sources, container);
  }
}

function updateStreamingBubble(messageId, text, withCursor = false) {
  const article = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!article) return;
  const body = article.querySelector(".bubble");
  if (!body) return;
  const rendered = renderMarkdown(text + (withCursor ? "▍" : ""));
  body.innerHTML = rendered;
}

function renderChat() {
  refs.chatLog.innerHTML = "";
  const conv = currentConversation();
  if (!conv) return;

  refs.chatTitle.textContent = conv.title;
  refs.chatMeta.textContent = `${conv.messages.length} messages • ${makeModeLabel(conv.mode || state.settings.mode)} • ${conv.provider || state.settings.provider}`;

  for (const message of conv.messages) {
    const msg = document.createElement("article");
    msg.className = `message ${message.role}`;
    msg.dataset.messageId = message.id;

    const head = document.createElement("header");

    const meta = document.createElement("div");
    meta.className = "meta";
    const sentBy = message.role === "user" ? "You" : "Hexa";
    const time = new Date(message.createdAt).toLocaleTimeString();
    meta.textContent = `${sentBy} • ${time}`;

    const modeTag = document.createElement("span");
    modeTag.className = "mode-tag";
    const msgMode = (message.metadata && message.metadata.mode) || conv.mode || state.settings.mode;
    modeTag.textContent = makeModeLabel(msgMode);

    head.appendChild(meta);
    head.appendChild(modeTag);

    const body = document.createElement("div");
    body.className = "bubble";
    body.innerHTML = renderMarkdown(message.content || "");

    const statusLine = document.createElement("div");
    statusLine.className = "status-line";

    if (message.metadata && message.metadata.provider) {
      statusLine.textContent = `provider: ${message.metadata.provider}`;
    }

    const actions = document.createElement("div");
    actions.className = "top-actions";

    const copy = document.createElement("button");
    copy.className = "btn secondary";
    copy.type = "button";
    copy.textContent = "Copy";
    copy.onclick = async () => {
      await navigator.clipboard.writeText(message.content || "");
    };
    actions.appendChild(copy);

    if (message.role === "assistant") {
      const regen = document.createElement("button");
      regen.className = "btn secondary";
      regen.type = "button";
      regen.textContent = "Regenerate";
      regen.onclick = () => regenerateMessage(message.id);
      actions.appendChild(regen);
    }

    msg.appendChild(head);
    msg.appendChild(body);

    if (statusLine.textContent) {
      msg.appendChild(statusLine);
    }

    renderMessageMeta(message.metadata, msg);
    msg.appendChild(actions);
    refs.chatLog.appendChild(msg);
  }

  refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
}

function renderAttachments() {
  refs.attachments.innerHTML = "";
  for (const file of pendingAttachments) {
    const chip = document.createElement("span");
    chip.className = "attach-pill";
    chip.textContent = `${file.name} (${file.size})`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn secondary";
    remove.textContent = "×";
    remove.style.marginLeft = "6px";
    remove.onclick = () => {
      pendingAttachments = pendingAttachments.filter((f) => f.id !== file.id);
      renderAttachments();
    };

    chip.appendChild(remove);
    refs.attachments.appendChild(chip);
  }
}

function setControlsDisabled(disabled) {
  refs.sendButton.disabled = disabled;
  refs.stopButton.disabled = !disabled;
}

function readAttachment(file) {
  const payload = {
    id: makeId(),
    name: file.name,
    type: file.type || "text/plain",
    size: `${Math.round(file.size / 1024)} KB`
  };

  return new Promise((resolve) => {
    const isTextLike =
      file.type.includes("text") ||
      file.name.match(/\.(txt|md|js|ts|json|yml|yaml|html|css|py|java|cpp|c|go|sh|rs|tsx|jsx|vue|toml|ini|sql|csv)$/i);

    if (!isTextLike) {
      resolve(payload);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      payload.content = String(reader.result || "").slice(0, 1400);
      resolve(payload);
    };
    reader.onerror = () => resolve(payload);
    reader.readAsText(file);
  });
}

function formatAttachmentsForPrompt() {
  if (!pendingAttachments.length) return "";

  const lines = ["\n\n[Attached files]"];
  for (const file of pendingAttachments) {
    lines.push(`- ${file.name} (${file.size})`);
    if (file.content) {
      lines.push("```\n" + file.content + "\n```");
    }
  }

  return lines.join("\n");
}

function composeUserContent(rawText) {
  const conv = currentConversation();
  const memoryText = (conv?.notes || state.settings.memory || "").trim();
  const attachmentPart = formatAttachmentsForPrompt();

  if (memoryText) {
    return `[Session memory]\n${memoryText}\n\n${rawText}${attachmentPart}`;
  }

  return `${rawText}${attachmentPart}`;
}

function fallbackReply(mode, userPrompt) {
  const lower = userPrompt.toLowerCase();
  const isCode = /\b(code|coding|function|debug|implement|snippet|javascript|python|typescript|react|node|api|sql|html|css|bash|shell|devops|deploy|git|github|error|exception|stack)\b/i.test(lower);
  const isDecision = /\b(compare|choose|recommend|which|pros|cons|analysis|trade.?off|should|best|evaluate|decision)\b/i.test(lower);

  if (isCode) {
    return {
      content: `Exact answer: share stack and constraints, and I will return ready-to-run code immediately.`,
      metadata: {
        mode,
        confidence: 0.89
      }
    };
  }

  if (mode === "search") {
    return {
      content: `Exact answer: I can give a direct response from knowledge, but live browsing is unavailable in fallback mode.`,
      metadata: {
        mode,
        confidence: 0.6
      }
    };
  }

  if (mode === "reason") {
    return {
      content: "Exact answer: tell me your goal in one line and I’ll return the final decision directly.",
      metadata: {
        mode,
        confidence: 0.58
      }
    };
  }

  if (mode === "workflow") {
    return {
      content: "Exact answer: define one target task and I will output the exact next action only.",
      metadata: {
        mode,
        confidence: 0.71
      }
    };
  }

  return {
    content: isDecision
      ? "Exact answer: I recommend the option that best matches your constraints—say one priority and I’ll choose it."
      : "Exact answer: ask one focused question and I’ll reply with a direct, final response.",
    metadata: {
      mode,
      confidence: 0.75
    }
  };
}

function timeoutController(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, cancel: () => clearTimeout(timer) };
}

function shouldRetry(status) {
  return !status || status >= 500 || status === 408 || status === 429 || status === 524 || status === 0;
}

function parseProviderResponse(provider, data) {
  const meta = {};

  if (typeof data?.confidence === "number") {
    meta.confidence = data.confidence;
  }

  if (Array.isArray(data?.process)) {
    meta.process = data.process;
  }

  const sourcesCandidate =
    data?.sources || data?.citations || data?.references || data?.results?.sources || data?.results?.citations;

  const sources = parseSources(sourcesCandidate);
  if (sources.length) {
    meta.sources = sources;
  }

  if (provider === "anthropic") {
    const bodyText = data?.content?.map((x) => x.text).join("") || "";
    if (bodyText.trim()) {
      return {
        content: bodyText.trim(),
        metadata: meta,
        toolCalls: [],
        assistantMessage: { role: "assistant", content: bodyText.trim() }
      };
    }
  }

  const messageNode = data?.choices?.[0]?.message || data?.choices?.[0] || {};
  const toolCalls = Array.isArray(messageNode?.tool_calls)
    ? messageNode.tool_calls
      .map((call, index) => normalizeToolCall(call, index))
      .filter(Boolean)
    : [];

  const choicesText = messageNode?.content || data?.output_text || data?.message?.content;
  const hasText = typeof choicesText === "string" && choicesText.trim();
  const normalizedChoiceMessage = {
    role: "assistant",
    content: hasText ? String(choicesText).trim() : "",
    tool_calls: toolCalls.length
      ? toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: typeof call.args === "string" ? call.args : JSON.stringify(call.args || {})
          }
        }))
      : undefined
  };

  if (hasText) {
    if (typeof messageNode?.role !== "undefined" && typeof messageNode?.content !== "undefined") {
      const maybeSources = parseSources(messageNode?.sources);
      if (maybeSources.length) {
        meta.sources = maybeSources;
      }
    }

    return {
      content: String(choicesText).trim(),
      metadata: meta,
      toolCalls,
      assistantMessage: normalizedChoiceMessage
    };
  }

  if (typeof data?.content === "string" && data.content.trim()) {
    return {
      content: data.content.trim(),
      metadata: meta,
      toolCalls: [],
      assistantMessage: {
        role: "assistant",
        content: data.content.trim()
      }
    };
  }

  return {
    content: toolCalls.length ? "" : null,
    metadata: meta,
    toolCalls,
    assistantMessage: normalizedChoiceMessage
  };
}

async function fetchFromProvider(provider, model, contextMessages, mode) {
  const providerConfig = getProviderConfig(provider);
  const endpoint = providerConfig.endpoint || PROVIDERS[provider].endpoint;
  if (!endpoint) return null;

  const body = {
    model,
    max_tokens: state.settings.maxTokens,
    temperature: state.settings.temperature,
    messages: [
      {
        role: "system",
        content: MODE_HINTS[mode]?.system || MODE_HINTS.chat.system
      },
      ...contextMessages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
      }))
    ]
  };

  if (mode === "search") {
    body.return_sources = true;
    body.web_search = true;
  }

  if (state.settings.enableTools && PROVIDERS[provider]?.supportsTools) {
    body.tools = OPENAI_TOOL_SCHEMA;
    body.tool_choice = "auto";
  }

  let apiHeaders = {
    "Content-Type": "application/json"
  };

  const key = provider === "perplexity"
    ? state.settings.searchApiKey || providerConfig.apiKey
    : state.settings.apiKey || providerConfig.apiKey;

  const providerHeaders = PROVIDERS[provider]?.headers?.(provider === "perplexity" ? key : key);
  if (providerHeaders && Object.keys(providerHeaders).length) {
    apiHeaders = {
      ...apiHeaders,
      ...providerHeaders
    };
  }

  const timeout = timeoutController(state.settings.timeoutMs || 12000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(body),
      signal: timeout.controller.signal
    });

    timeout.cancel();

    if (!response.ok) {
      if (provider === "perplexity" && mode !== "search" && !response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return { error: response.status };
    }

    const data = await response.json();
    const parsed = parseProviderResponse(provider, data);
    if (!parsed || (parsed.content === null && !Array.isArray(parsed.toolCalls))) {
      return null;
    }

    return {
      content: parsed.content,
      metadata: {
        ...(parsed.metadata || {}),
        mode,
        provider,
        model
      },
      toolCalls: parsed.toolCalls || [],
      assistantMessage: parsed.assistantMessage,
      rawStatus: "ok"
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("timeout");
    }
    return null;
  }
}

async function runToolWorkflowFromProvider(provider, model, contextMessages, mode) {
  const history = contextMessages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.name ? { name: message.name } : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
  }));

  const allToolRuns = [];
  const maxToolRounds = 4;

  for (let round = 0; round < maxToolRounds; round += 1) {
    if (state.stopRequested) {
      return { content: "(stopped)", metadata: { mode, provider } };
    }

    const attempt = await fetchFromProvider(provider, model, history, mode);
    if (!attempt) {
      return null;
    }
    if (attempt.error) {
      return attempt;
    }

    const toolCalls = Array.isArray(attempt.toolCalls) ? attempt.toolCalls : [];
    if (toolCalls.length && state.settings.enableTools && PROVIDERS[provider]?.supportsTools) {
      const toolRunsThisRound = [];
      for (const call of toolCalls) {
        const run = await hydrateToolExecution(call.name, call.args);
        run.id = call.id;
        if (!run || !call.name) continue;
        run.round = round + 1;
        toolRunsThisRound.push(run);
      }

      allToolRuns.push(...toolRunsThisRound);
      history.push({
        role: "assistant",
        content: attempt.content || "",
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: typeof call.args === "string" ? call.args : JSON.stringify(call.args || {})
          }
        }))
      });
      appendToolMessagesToHistory(history, toolRunsThisRound);
      continue;
    }

    if (!toolCalls.length && !attempt.content && allToolRuns.length) {
      return {
        content: "Workflow completed all tool steps. No final narrative text was returned by the model.",
        metadata: {
          ...(attempt.metadata || {}),
          tools: allToolRuns,
          toolMode: "workflow",
          toolRounds: round + 1
        }
      };
    }

    return {
      content: attempt.content,
      metadata: {
        ...(attempt.metadata || {}),
        ...(allToolRuns.length ? { tools: allToolRuns, toolMode: "workflow", toolRounds: allToolRuns.length } : {})
      }
    };
  }

  return {
    content: "Workflow reached the tool execution limit before producing a final response.",
    metadata: {
      mode,
      provider,
      model,
      tools: allToolRuns,
      toolMode: "workflow-limited"
    }
  };
}

async function fetchFromApi(mode, contextMessages) {
  const orderedProviders = MODE_TO_PROVIDER[mode] || [currentProvider()];
  const requestModel = refs.modelSelect.value || getActiveModel(currentProvider());
  const maxRetries = Math.max(0, Number(state.settings.retryCount || 0));

  for (const provider of orderedProviders) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (state.stopRequested) return { content: "(stopped)", metadata: { mode, provider } };

      const useToolLoop = state.settings.enableTools && PROVIDERS[provider]?.supportsTools && mode !== "search";
      const response = useToolLoop
        ? await runToolWorkflowFromProvider(provider, requestModel, contextMessages, mode)
        : await fetchFromProvider(provider, requestModel, contextMessages, mode);

      const hasAnyToolOutput = Array.isArray(response?.metadata?.tools) && response.metadata.tools.length;
      if (response && response.content !== null && response.content !== undefined) {
        if (response.content !== "" || hasAnyToolOutput) {
          return response;
        }
      }

      if (response && response.error) {
        if (!shouldRetry(response.error) || attempt >= maxRetries) {
          break;
        }
      } else if (!response) {
        if (attempt >= maxRetries) {
          break;
        }
      }

      const waitMs = 300 * 2 ** attempt;
      await sleep(waitMs);
    }
  }

  return null;
}

async function streamTextToMessage(message, text, onComplete) {
  const target = text || "";
  const size = target.length;
  let cursor = 0;
  message.content = "";
  const step = () => {
    const chunk = Math.max(2, Math.round((Math.random() * 5) + 1));
    cursor = Math.min(size, cursor + chunk);
    message.content = target.slice(0, cursor);
    updateStreamingBubble(message.id, message.content, true);
    if (state.stopRequested || cursor >= size) {
      return;
    }
    state.streamHandle = setTimeout(step, 14 + Math.random() * 16);
  };

  step();

  while (cursor < size && !state.stopRequested) {
    await sleep(20);
  }

  if (state.streamHandle) {
    clearTimeout(state.streamHandle);
    state.streamHandle = null;
  }

  if (state.stopRequested) {
    if (!message.content) {
      message.content = "(stopped)";
    }
    updateStreamingBubble(message.id, message.content, false);
    if (onComplete) onComplete("stopped");
    return;
  }

  message.content = target;
  updateStreamingBubble(message.id, target, false);
  if (onComplete) onComplete("done");
}

async function generateReply(mode, contextMessages, userPrompt, placeholder) {
  if (state.stopRequested) {
    return { content: "(stopped)", metadata: { mode } };
  }

  const explicitTool = parseToolInvocation(userPrompt);
  if (state.settings.enableTools && mode === "workflow") {
    const workflowResult = await runLocalWorkflowFromPrompt(userPrompt);
    if (workflowResult) {
      await streamTextToMessage(
        placeholder,
        workflowResult.content,
        () => {}
      );

      return {
        content: workflowResult.content,
        metadata: {
          mode,
          provider: currentProvider(),
          ...(workflowResult.metadata || {})
        }
      };
    }
  }

  if (state.settings.enableTools && explicitTool && explicitTool.name) {
    const direct = await runLocalTool(explicitTool.name, explicitTool.rawArgs);
    const toolMessage = direct.success
      ? `Tool executed: ${explicitTool.name}\n\n${direct.output}`
      : `Tool execution failed: ${explicitTool.name}\n\n${direct.output}`;
    await streamTextToMessage(
      placeholder,
      toolMessage,
      () => {}
    );

    return {
      content: toolMessage,
      metadata: {
        mode,
        provider: currentProvider(),
        tools: [
          {
            name: explicitTool.name,
            status: direct.success ? "ok" : "error",
            args: explicitTool.rawArgs,
            output: direct.output || ""
          }
        ],
        toolMode: "manual"
      }
    };
  }

  const apiReply = await fetchFromApi(mode, contextMessages);
  if (state.stopRequested) return { content: "(stopped)", metadata: { mode } };

  const finalReply = apiReply || fallbackReply(mode, userPrompt);
  if (state.stopRequested) return { content: "(stopped)", metadata: { mode } };

  await streamTextToMessage(
    placeholder,
    finalReply.content,
    () => {}
  );

  return finalReply;
}

async function sendMessage() {
  if (state.isGenerating) return;
  const rawText = refs.messageInput.value.trim();
  if (!rawText && !pendingAttachments.length) return;

  const conv = currentConversation();
  if (!conv) return;

  const mode = normalizeMode(refs.modeSelect.value);
  const provider = normalizeProvider(refs.providerSelect.value || currentProvider());
  conv.mode = mode;
  conv.provider = provider;

  const userContent = composeUserContent(rawText);

  const userMessage = {
    id: makeId(),
    role: "user",
    content: userContent,
    createdAt: Date.now(),
    metadata: {
      mode,
      provider
    }
  };

  conv.messages.push(userMessage);
  state.settings.mode = mode;
  state.settings.provider = provider;
  saveState();

  const firstUser = conv.messages.find((m) => m.role === "user");
  updateConversationTitle(conv, firstUser?.content || "New chat");

  refs.messageInput.value = "";
  pendingAttachments = [];
  renderAttachments();

  const placeholder = {
    id: makeId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    metadata: {
      mode,
      provider
    }
  };
  conv.messages.push(placeholder);

  renderAll();

  state.isGenerating = true;
  state.stopRequested = false;
  setControlsDisabled(true);

  const result = await generateReply(mode, conv.messages.slice(0, -1), rawText || "(attachment-only)", placeholder);

  if (!state.stopRequested) {
    placeholder.metadata = {
      ...placeholder.metadata,
      ...(result.metadata || {})
    };
    if (result.content && result.content !== "(stopped)") {
      placeholder.content = result.content;
      placeholder.metadata.mode = mode;
      placeholder.metadata.provider = result.metadata?.provider || provider;
    } else {
      placeholder.content = result.content;
    }
  }

  state.isGenerating = false;
  saveState();
  setControlsDisabled(false);
  renderAll();
}

function stopGeneration() {
  if (!state.isGenerating) return;
  state.stopRequested = true;
  if (state.streamHandle) {
    clearTimeout(state.streamHandle);
    state.streamHandle = null;
  }
}

function regenerateMessage(messageId) {
  if (state.isGenerating) return;
  const conv = currentConversation();
  if (!conv) return;

  const index = conv.messages.findIndex((message) => message.id === messageId);
  if (index <= 0) return;

  const previousUser = conv.messages[index - 1];
  if (!previousUser || previousUser.role !== "user") return;

  const mode = normalizeMode(previousUser.metadata?.mode || conv.mode || "chat");
  const provider = normalizeProvider(previousUser.metadata?.provider || conv.provider || state.settings.provider);

  conv.messages = conv.messages.slice(0, index);
  conv.mode = mode;
  conv.provider = provider;

  const attachmentlessPrompt = previousUser.content.split("\n\n[Attached files]")[0];

  const placeholder = {
    id: makeId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    metadata: {
      mode,
      provider
    }
  };
  conv.messages.push(placeholder);
  state.settings.mode = mode;
  state.settings.provider = provider;
  refs.modeSelect.value = mode;
  refs.providerSelect.value = provider;
  refs.providerConfig.value = provider;
  populateModelOptions(provider);
  saveState();

  renderAll();

  state.isGenerating = true;
  state.stopRequested = false;
  setControlsDisabled(true);

  generateReply(mode, conv.messages.slice(0, -1), attachmentlessPrompt, placeholder).then((result) => {
    if (state.stopRequested) {
      state.isGenerating = false;
      setControlsDisabled(false);
      return;
    }

    placeholder.metadata = {
      ...placeholder.metadata,
      ...(result.metadata || {}),
      mode,
      provider
    };
    if (result.content) {
      placeholder.content = result.content;
    }

    state.isGenerating = false;
    saveState();
    setControlsDisabled(false);
    renderAll();
  });
}

function exportConversations() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hexa-ai-export.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importConversations(file) {
  const content = await file.text();
  const parsed = JSON.parse(content);

  if (!parsed?.conversations) {
    alert("Invalid file format.");
    return;
  }

  state.conversations = parsed.conversations || [];
  state.activeConversationId = parsed.activeConversationId || state.conversations[0]?.id || null;
  state.settings = {
    ...state.settings,
    ...(parsed.settings || {}),
    mode: normalizeMode(parsed.settings?.mode),
    provider: normalizeProvider(parsed.settings?.provider)
  };

  if (!state.settings.providers) {
    state.settings.providers = getDefaultProviders();
  } else {
    state.settings.providers = {
      ...getDefaultProviders(),
      ...state.settings.providers,
      openai: { ...getDefaultProviders().openai, ...(state.settings.providers.openai || {}) },
      chatgpt: { ...getDefaultProviders().chatgpt, ...(state.settings.providers.chatgpt || {}) },
      deepseek: { ...getDefaultProviders().deepseek, ...(state.settings.providers.deepseek || {}) },
      groq: { ...getDefaultProviders().groq, ...(state.settings.providers.groq || {}) },
      xai: { ...getDefaultProviders().xai, ...(state.settings.providers.xai || {}) },
      anthropic: { ...getDefaultProviders().anthropic, ...(state.settings.providers.anthropic || {}) },
      claude: { ...getDefaultProviders().claude, ...(state.settings.providers.claude || {}) },
      google: { ...getDefaultProviders().google, ...(state.settings.providers.google || {}) },
      perplexity: { ...getDefaultProviders().perplexity, ...(state.settings.providers.perplexity || {}) }
    };
  }

  syncProvidersFromLegacySettings(parsed);
  if (typeof state.settings.enableTools !== "boolean") {
    state.settings.enableTools = false;
  }

  if (!state.conversations.length) {
    createConversation(false);
  }

  populateProviderSelects();
  populateModelOptions(state.settings.provider);
  buildTemplateChoices(state.settings.mode);

  refs.modeSelect.value = state.settings.mode;
  refs.providerSelect.value = state.settings.provider;
  refs.providerConfig.value = state.settings.provider;

  const config = getProviderConfig(state.settings.provider);
  refs.apiEndpoint.value = config.endpoint || "";
  refs.apiKey.value = config.apiKey || "";
  refs.searchEndpoint.value = state.settings.searchEndpoint || "";
  refs.searchApiKey.value = state.settings.searchApiKey || "";
  refs.enableTools.checked = state.settings.enableTools || false;

  refs.temperature.value = state.settings.temperature || 0.6;
  refs.tempLabel.textContent = state.settings.temperature || 0.6;
  refs.maxTokens.value = state.settings.maxTokens || 1024;
  refs.maxLabel.textContent = state.settings.maxTokens || 1024;
  refs.timeoutMs.value = state.settings.timeoutMs || 12000;
  refs.timeoutLabel.textContent = state.settings.timeoutMs || 12000;
  refs.retryCount.value = state.settings.retryCount || 2;
  refs.retryLabel.textContent = state.settings.retryCount || 2;

  const current = currentConversation();
  refreshMemoryInputs(current);
  saveState();
  renderAll();
}

function renderAll() {
  const conv = currentConversation();
  if (conv) {
    refreshMemoryInputs(conv);
  }
  renderConversations();
  renderChat();
}

function applyProviderToSettingsUI() {
  const provider = normalizeProvider(refs.providerSelect.value || state.settings.provider);
  refs.providerSelect.value = provider;
  refs.providerConfig.value = provider;
  state.settings.provider = provider;
  const config = getProviderConfig(provider);
  refs.apiEndpoint.value = config.endpoint || "";
  refs.apiKey.value = config.apiKey || "";
  populateModelOptions(provider);
  buildTemplateChoices(currentMode());
}

function setupProviderModelDefaults() {
  const model = getProviderConfig(state.settings.provider).model;
  if (!model) {
    state.settings.providers[state.settings.provider].model = getActiveModel(state.settings.provider);
  }
}

function bindEvents() {
  refs.newChatButton.addEventListener("click", () => {
    createConversation();
    renderAll();
  });

  refs.sendButton.addEventListener("click", () => {
    sendMessage().catch(console.error);
  });

  refs.stopButton.addEventListener("click", () => {
    stopGeneration();
  });

  refs.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage().catch(console.error);
    }
  });

  refs.insertTemplate.addEventListener("click", () => {
    const template = refs.templateSelect.value;
    if (!template) return;
    refs.messageInput.value = template;
  });

  refs.providerSelect.addEventListener("change", () => {
    applyProviderToSettingsUI();
    if (currentConversation()) {
      currentConversation().provider = normalizeProvider(refs.providerSelect.value);
    }
    buildTemplateChoices(currentMode());
    renderAll();
  });

  refs.providerConfig.addEventListener("change", () => {
    refs.providerSelect.value = refs.providerConfig.value;
    applyProviderToSettingsUI();
  });

  refs.modeSelect.addEventListener("change", () => {
    state.settings.mode = normalizeMode(refs.modeSelect.value);
    if (currentConversation()) {
      currentConversation().mode = state.settings.mode;
    }
    buildTemplateChoices(state.settings.mode);
    renderAll();
  });

  refs.modelSelect.addEventListener("change", () => {
    const provider = currentProvider();
    state.settings.providers[provider] = {
      ...state.settings.providers[provider],
      model: refs.modelSelect.value
    };
    saveState();
  });

  refs.fileInput.addEventListener("change", async () => {
    const files = [...refs.fileInput.files];
    const loaded = await Promise.all(files.map((file) => readAttachment(file)));
    pendingAttachments.push(...loaded);
    refs.fileInput.value = "";
    renderAttachments();
  });

  refs.searchInput.addEventListener("input", renderConversations);

  refs.exportButton.addEventListener("click", exportConversations);

  refs.importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importConversations(file).catch(() => alert("Could not import file."));
    event.target.value = "";
  });

  refs.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    updateThemeButton();
    persistTheme();
  });

  refs.saveMemory.addEventListener("click", () => {
    const conv = currentConversation();
    const value = refs.memoryInput.value.trim();
    state.settings.memory = value;
    if (conv) {
      conv.notes = value;
      conv.memory = value;
    }
    saveState();
    renderConversations();
  });

  refs.clearMemory.addEventListener("click", () => {
    refs.memoryInput.value = "";
    state.settings.memory = "";
    const conv = currentConversation();
    if (conv) {
      conv.notes = "";
      conv.memory = "";
    }
    saveState();
  });

  refs.settingsToggle.addEventListener("click", () => {
    const provider = currentProvider();
    refs.providerConfig.value = provider;
    const config = getProviderConfig(provider);
    refs.apiEndpoint.value = config.endpoint || "";
    refs.apiKey.value = config.apiKey || "";
    refs.searchEndpoint.value = state.settings.searchEndpoint || "";
    refs.searchApiKey.value = state.settings.searchApiKey || "";
    refs.enableTools.checked = !!state.settings.enableTools;
    refs.temperature.value = state.settings.temperature;
    refs.tempLabel.textContent = state.settings.temperature;
    refs.maxTokens.value = state.settings.maxTokens;
    refs.maxLabel.textContent = state.settings.maxTokens;
    refs.timeoutMs.value = state.settings.timeoutMs;
    refs.timeoutLabel.textContent = state.settings.timeoutMs;
    refs.retryCount.value = state.settings.retryCount;
    refs.retryLabel.textContent = state.settings.retryCount;
    refs.settingsDialog.showModal();
  });

  refs.temperature.addEventListener("input", () => {
    refs.tempLabel.textContent = refs.temperature.value;
  });

  refs.maxTokens.addEventListener("input", () => {
    refs.maxLabel.textContent = refs.maxTokens.value;
  });

  refs.timeoutMs.addEventListener("input", () => {
    refs.timeoutLabel.textContent = refs.timeoutMs.value;
  });

  refs.retryCount.addEventListener("input", () => {
    refs.retryLabel.textContent = refs.retryCount.value;
  });

  refs.saveSettings.addEventListener("click", (event) => {
    event.preventDefault();

    const selectedProvider = normalizeProvider(refs.providerConfig.value);
    const config = getProviderConfig(selectedProvider);
    const rawEndpoint = refs.apiEndpoint.value.trim();
    const rawKey = refs.apiKey.value.trim();

    state.settings.provider = selectedProvider;
    state.settings.providers[selectedProvider] = {
      ...config,
      endpoint: rawEndpoint,
      apiKey: rawKey
    };

    state.settings.searchEndpoint = refs.searchEndpoint.value.trim();
    state.settings.searchApiKey = refs.searchApiKey.value.trim();
    state.settings.enableTools = !!refs.enableTools.checked;
    state.settings.temperature = Number(refs.temperature.value);
    state.settings.maxTokens = Number(refs.maxTokens.value);
    state.settings.timeoutMs = Number(refs.timeoutMs.value);
    state.settings.retryCount = Number(refs.retryCount.value);
    state.settings.mode = normalizeMode(refs.modeSelect.value);

    const provider = normalizeProvider(selectedProvider);
    refs.providerSelect.value = provider;
    refs.apiEndpoint.value = state.settings.providers[provider].endpoint;
  refs.apiKey.value = state.settings.providers[provider].apiKey;

    populateProviderSelects();
    populateModelOptions(provider);
    const conv = currentConversation();
    if (conv) {
      conv.provider = provider;
      conv.mode = state.settings.mode;
    }

    buildTemplateChoices(state.settings.mode);
    saveState();
    refs.settingsDialog.close();
    renderAll();
  });
}

function init() {
  populateProviderSelects();
  applyThemeFromStorage();
  setupProviderModelDefaults();
  bindEvents();
  buildTemplateChoices(currentMode());
  loadState();
}

init();
