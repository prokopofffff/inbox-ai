import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classificationResultSchema,
  type ClassifyEmailInput,
} from "@/lib/schemas";

/**
 * Tests for services/openai.ts.
 *
 * The service reads `hasOpenAI` / `env` from "@/lib/env" at module load, and
 * lazily constructs the OpenAI client. To exercise both the mock-mode path
 * (no key) and the real path (key present), we control `@/lib/env` via
 * `vi.mock` and re-import the service with `vi.resetModules()` per scenario.
 *
 * The real OpenAI SDK and its zod helper are mocked so no network is hit.
 */

// A valid classification object that satisfies classificationResultSchema.
const VALID_RESULT = {
  category: "SUPPORT",
  priority: "HIGH",
  summary: "User cannot log in and needs help.",
  suggestedReply: "Hi there, we're looking into your login issue now.",
  sentiment: "NEGATIVE",
  confidence: 0.91,
  assignee: "Alice",
} as const;

const SAMPLE_INPUT: ClassifyEmailInput = {
  subject: "Login is broken",
  fromAddr: "user@example.com",
  fromName: "Jane User",
  bodyText: "I keep getting an error and it is not working. Please help.",
  knownAssignees: ["Alice", "Bob"],
};

// ---------------------------------------------------------------------------
// Mock the OpenAI SDK. The service imports the default export as a class and
// calls `new OpenAI(...)`, then uses `.responses.parse` / `.responses.create`.
// ---------------------------------------------------------------------------

const parseMock = vi.fn();
const createMock = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    responses = {
      parse: parseMock,
      create: createMock,
    };
    constructor(_opts?: unknown) {}
  }
  return { default: MockOpenAI };
});

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn(() => ({ type: "json_schema", name: "mock_format" })),
}));

/** Load the service with `hasOpenAI` forced to a given value. */
async function loadService(hasOpenAI: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    hasOpenAI,
    env: {
      OPENAI_API_KEY: hasOpenAI ? "sk-real-test-key" : undefined,
      OPENAI_MODEL: "gpt-4o-mini",
    },
  }));
  return import("./openai");
}

/** Build a fake Responses API result object. */
function parseResult(opts: {
  output_parsed?: unknown;
  output_text?: string;
}) {
  return {
    output_parsed: opts.output_parsed ?? null,
    output_text: opts.output_text ?? "",
  };
}

/** An async iterable of streaming events, like the real Responses stream. */
function makeStream(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
  };
}

beforeEach(() => {
  parseMock.mockReset();
  createMock.mockReset();
});

afterEach(() => {
  vi.doUnmock("@/lib/env");
});

// ===========================================================================
// classifyEmail — real path (hasOpenAI = true)
// ===========================================================================

describe("classifyEmail (real path, SDK mocked)", () => {
  it("(a) parses a valid structured response into a schema-valid result", async () => {
    parseMock.mockResolvedValueOnce(
      parseResult({ output_parsed: VALID_RESULT, output_text: JSON.stringify(VALID_RESULT) }),
    );

    const { classifyEmail } = await loadService(true);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(() => classificationResultSchema.parse(result)).not.toThrow();
    expect(result).toEqual(VALID_RESULT);
    expect(parseMock).toHaveBeenCalledTimes(1);

    // Sanity-check the request shape the service sends.
    const callArg = parseMock.mock.calls[0][0];
    expect(callArg.model).toBe("gpt-4o-mini");
    expect(callArg.input[0].role).toBe("system");
    expect(callArg.input[1].role).toBe("user");
    expect(callArg.input[1].content).toContain("Login is broken");
  });

  it("falls back to manually parsing output_text when output_parsed is null", async () => {
    parseMock.mockResolvedValueOnce(
      parseResult({ output_parsed: null, output_text: JSON.stringify(VALID_RESULT) }),
    );

    const { classifyEmail } = await loadService(true);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(result).toEqual(VALID_RESULT);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("(b) retries once when the first output is invalid, then succeeds", async () => {
    // First attempt: unparseable text + no parsed object -> invalid.
    parseMock.mockResolvedValueOnce(
      parseResult({ output_parsed: null, output_text: "not json at all {" }),
    );
    // Second attempt: valid parsed object.
    parseMock.mockResolvedValueOnce(
      parseResult({ output_parsed: VALID_RESULT, output_text: JSON.stringify(VALID_RESULT) }),
    );

    const { classifyEmail } = await loadService(true);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(result).toEqual(VALID_RESULT);
    expect(parseMock).toHaveBeenCalledTimes(2);

    // The retry prompt should signal the previous response was invalid.
    const retryArg = parseMock.mock.calls[1][0];
    expect(retryArg.input[1].content).toContain("previous response was invalid");
  });

  it("retries when the parsed object fails schema validation, then succeeds", async () => {
    // output_parsed present but invalid (bad enum + out-of-range confidence).
    parseMock.mockResolvedValueOnce(
      parseResult({
        output_parsed: { ...VALID_RESULT, category: "NOPE", confidence: 5 },
        output_text: "{}",
      }),
    );
    parseMock.mockResolvedValueOnce(
      parseResult({ output_parsed: VALID_RESULT }),
    );

    const { classifyEmail } = await loadService(true);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(result).toEqual(VALID_RESULT);
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("(c) throws a typed OpenAIClassificationError after two invalid attempts", async () => {
    parseMock
      .mockResolvedValueOnce(parseResult({ output_parsed: null, output_text: "garbage" }))
      .mockResolvedValueOnce(parseResult({ output_parsed: null, output_text: "still garbage" }));

    const { classifyEmail, OpenAIClassificationError } = await loadService(true);

    await expect(classifyEmail(SAMPLE_INPUT)).rejects.toBeInstanceOf(
      OpenAIClassificationError,
    );
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("preserves rawOutput and cause on the thrown typed error", async () => {
    parseMock
      .mockResolvedValueOnce(parseResult({ output_parsed: null, output_text: "bad-1" }))
      .mockResolvedValueOnce(parseResult({ output_parsed: null, output_text: "bad-2" }));

    const { classifyEmail, OpenAIClassificationError } = await loadService(true);

    try {
      await classifyEmail(SAMPLE_INPUT);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenAIClassificationError);
      const typed = err as InstanceType<typeof OpenAIClassificationError>;
      expect(typed.name).toBe("OpenAIClassificationError");
      expect(typed.rawOutput).toBe("bad-2");
      expect(typed.cause).toBeDefined();
    }
  });

  it("retries once when the SDK call itself throws, then throws typed error if both fail", async () => {
    parseMock
      .mockRejectedValueOnce(new Error("network blip"))
      .mockRejectedValueOnce(new Error("network blip again"));

    const { classifyEmail, OpenAIClassificationError } = await loadService(true);

    await expect(classifyEmail(SAMPLE_INPUT)).rejects.toBeInstanceOf(
      OpenAIClassificationError,
    );
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("recovers when the first SDK call throws but the retry succeeds", async () => {
    parseMock
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(parseResult({ output_parsed: VALID_RESULT }));

    const { classifyEmail } = await loadService(true);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(result).toEqual(VALID_RESULT);
    expect(parseMock).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// classifyEmail — mock mode (hasOpenAI = false)
// ===========================================================================

describe("classifyEmail (mock mode, no API key)", () => {
  it("returns a schema-valid result without calling the SDK", async () => {
    const { classifyEmail } = await loadService(false);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(() => classificationResultSchema.parse(result)).not.toThrow();
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("is deterministic — same input yields identical output", async () => {
    const { classifyEmail } = await loadService(false);
    const a = await classifyEmail(SAMPLE_INPUT);
    const b = await classifyEmail(SAMPLE_INPUT);
    expect(a).toEqual(b);
  });

  it("derives category/priority/sentiment from subject and body keywords", async () => {
    const { classifyEmail } = await loadService(false);

    const support = await classifyEmail({
      subject: "It is broken",
      bodyText: "urgent error, nothing is working",
    });
    expect(support.category).toBe("SUPPORT");
    expect(support.priority).toBe("URGENT");

    const spam = await classifyEmail({
      subject: "You are a lottery winner",
      bodyText: "claim your free money now, unsubscribe here",
    });
    expect(spam.category).toBe("SPAM");
    expect(spam.priority).toBe("LOW");

    const billing = await classifyEmail({
      subject: "Invoice question",
      bodyText: "I have a question about a charge on my payment.",
    });
    expect(billing.category).toBe("BILLING");

    const sales = await classifyEmail({
      subject: "Pricing and demo request",
      bodyText: "We'd like a quote to purchase.",
    });
    expect(sales.category).toBe("SALES");
  });

  it("picks an assignee from knownAssignees, or null when none provided", async () => {
    const { classifyEmail } = await loadService(false);

    const withRoster = await classifyEmail(SAMPLE_INPUT);
    expect(["Alice", "Bob"]).toContain(withRoster.assignee);

    const noRoster = await classifyEmail({
      subject: "Hello",
      bodyText: "Just saying hi.",
    });
    expect(noRoster.assignee).toBeNull();
  });

  it("keeps confidence within [0.7, 0.98] and reflects the subject in the summary", async () => {
    const { classifyEmail } = await loadService(false);
    const result = await classifyEmail(SAMPLE_INPUT);

    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.confidence).toBeLessThanOrEqual(0.98);
    expect(result.summary).toContain("Login is broken");
  });
});

// ===========================================================================
// mockClassify (exported directly)
// ===========================================================================

describe("mockClassify", () => {
  it("handles empty input and still produces a valid result", async () => {
    const { mockClassify } = await loadService(false);
    const result = mockClassify({});
    expect(() => classificationResultSchema.parse(result)).not.toThrow();
    expect(result.category).toBe("GENERAL");
    expect(result.assignee).toBeNull();
    // No subject -> summary uses the category/priority sentence.
    expect(result.summary).toMatch(/general email/i);
  });
});

// ===========================================================================
// streamSuggestedReply
// ===========================================================================

describe("streamSuggestedReply (real path, SDK mocked)", () => {
  it("yields only text deltas and completes", async () => {
    createMock.mockResolvedValueOnce(
      makeStream([
        { type: "response.output_text.delta", delta: "Hello " },
        { type: "response.created" }, // non-delta event, ignored
        { type: "response.output_text.delta", delta: "there" },
        { type: "response.output_text.delta", delta: "" }, // empty delta, skipped
        { type: "response.completed" },
      ]),
    );

    const { streamSuggestedReply } = await loadService(true);

    const chunks: string[] = [];
    for await (const c of streamSuggestedReply(SAMPLE_INPUT)) {
      chunks.push(c);
    }

    expect(chunks).toEqual(["Hello ", "there"]);
    expect(chunks.join("")).toBe("Hello there");
    expect(createMock).toHaveBeenCalledTimes(1);

    const arg = createMock.mock.calls[0][0];
    expect(arg.stream).toBe(true);
    expect(arg.model).toBe("gpt-4o-mini");
  });
});

describe("streamSuggestedReply (mock mode, no API key)", () => {
  it("yields chunks that concatenate to the mock reply and completes", async () => {
    const { streamSuggestedReply, mockClassify } = await loadService(false);

    const chunks: string[] = [];
    for await (const c of streamSuggestedReply(SAMPLE_INPUT)) {
      chunks.push(c);
    }

    expect(chunks.length).toBeGreaterThan(1);
    const full = chunks.join("");
    expect(full).toBe(mockClassify(SAMPLE_INPUT).suggestedReply);
    expect(full).toContain("Jane"); // sender first name
    expect(createMock).not.toHaveBeenCalled();
  });
});
