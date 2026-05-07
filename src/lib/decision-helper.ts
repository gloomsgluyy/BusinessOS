export type DecisionAction = "PROCEED" | "PROCEED_WITH_CONTROLS" | "HOLD" | "ESCALATE" | "NEED_DATA";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type SourceReliability = "INTERNAL_SYSTEM" | "API" | "AI_INFERENCE" | "USER_INPUT" | "UNKNOWN";

export type DecisionSource = {
  type: "internal" | "external" | "ai" | "document" | "market" | "weather" | "news";
  label: string;
  source: string;
  detail?: string;
  url?: string;
  observedAt?: string;
  reliability: SourceReliability;
};

export type DataQualityField = {
  label: string;
  value: unknown;
  critical?: boolean;
};

export type DecisionReportInput = {
  level: string;
  score: number;
  reason: string;
  owner: string;
  nextAction: string;
  deadline: string;
  missingFields?: string[];
  approverRoles?: string[];
  holdOnCritical?: boolean;
};

const VALID_ACTIONS = new Set<DecisionAction>(["PROCEED", "PROCEED_WITH_CONTROLS", "HOLD", "ESCALATE", "NEED_DATA"]);

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && value.trim().toLowerCase() !== "unknown";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function levelToDecision(level: string, missingFields: string[] = [], holdOnCritical = true): DecisionAction {
  const key = String(level || "").toUpperCase();
  const criticalMissing = missingFields.length >= 3;
  if (criticalMissing) return "NEED_DATA";
  if (key === "CRITICAL") return holdOnCritical ? "HOLD" : "ESCALATE";
  if (key === "HIGH") return "PROCEED_WITH_CONTROLS";
  if (key === "MEDIUM") return "PROCEED_WITH_CONTROLS";
  return "PROCEED";
}

export function decisionLabel(action: DecisionAction): string {
  if (action === "PROCEED") return "Proceed";
  if (action === "PROCEED_WITH_CONTROLS") return "Proceed with controls";
  if (action === "HOLD") return "Hold";
  if (action === "ESCALATE") return "Escalate";
  return "Need more data";
}

export function calculateDataQuality(fields: DataQualityField[]) {
  const total = Math.max(1, fields.length);
  const missing = fields.filter((field) => !hasValue(field.value));
  const criticalMissing = missing.filter((field) => field.critical).map((field) => field.label);
  const completenessScore = Math.round(((total - missing.length) / total) * 100);
  const warnings: string[] = [];

  if (criticalMissing.length > 0) {
    warnings.push(`Critical input missing: ${criticalMissing.join(", ")}.`);
  }
  if (completenessScore < 70) {
    warnings.push("Decision confidence is limited because supporting data is incomplete.");
  }

  return {
    completenessScore,
    missingFields: missing.map((field) => field.label),
    criticalMissingFields: criticalMissing,
    warnings,
  };
}

export function confidenceFromData(score: number, missingFields: string[] = [], sourceCount = 0): ConfidenceLevel {
  if (missingFields.length >= 4 || sourceCount < 2) return "LOW";
  if (missingFields.length >= 2 || sourceCount < 4 || score < 55) return "MEDIUM";
  return "HIGH";
}

export function buildSource(source: DecisionSource): DecisionSource {
  return {
    ...source,
    observedAt: source.observedAt || new Date().toISOString(),
    reliability: source.reliability || "UNKNOWN",
  };
}

export function buildDecisionReport(input: DecisionReportInput & { sourceCount?: number }) {
  const action = levelToDecision(input.level, input.missingFields || [], input.holdOnCritical);
  const confidence = confidenceFromData(input.score, input.missingFields, input.sourceCount);

  return {
    decision: {
      action,
      label: decisionLabel(action),
      reason: input.reason,
      owner: input.owner,
      nextAction: input.nextAction,
      deadline: input.deadline,
      confidence,
    },
    humanApproval: {
      required: ["HOLD", "ESCALATE", "PROCEED_WITH_CONTROLS", "NEED_DATA"].includes(action),
      approverRoles: input.approverRoles || [],
      status: "pending",
    },
  };
}

export function normalizeDecisionReport<T extends Record<string, any>>(report: T, input: DecisionReportInput & {
  sources: DecisionSource[];
  dataQuality: ReturnType<typeof calculateDataQuality>;
  inputSnapshot?: Record<string, unknown>;
}): T & {
  decision: ReturnType<typeof buildDecisionReport>["decision"];
  dataQuality: ReturnType<typeof calculateDataQuality>;
  sourceAttribution: DecisionSource[];
  inputSnapshot?: Record<string, unknown>;
  humanApproval: ReturnType<typeof buildDecisionReport>["humanApproval"];
} {
  const existingAction = String(report?.decision?.action || "").toUpperCase() as DecisionAction;
  const normalizedAction = VALID_ACTIONS.has(existingAction)
    ? existingAction
    : levelToDecision(input.level, input.dataQuality.missingFields, input.holdOnCritical);
  const base = buildDecisionReport({
    ...input,
    missingFields: input.dataQuality.missingFields,
    sourceCount: input.sources.length,
  });

  return {
    ...report,
    decision: {
      ...base.decision,
      ...(report.decision || {}),
      action: normalizedAction,
      label: report?.decision?.label || decisionLabel(normalizedAction),
      confidence: report?.decision?.confidence || base.decision.confidence,
    },
    dataQuality: input.dataQuality,
    sourceAttribution: input.sources,
    inputSnapshot: input.inputSnapshot,
    humanApproval: {
      ...base.humanApproval,
      ...(report.humanApproval || {}),
    },
  };
}
