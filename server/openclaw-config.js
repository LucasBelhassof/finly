import { z } from "zod";

const optionalString = z
  .string()
  .transform((value) => value.trim())
  .optional();

const openClawEnvironmentSchema = z
  .object({
    OPENCLAW_BASE_URL: optionalString,
    OPENCLAW_MODEL: optionalString,
    OPENCLAW_TIMEOUT_MS: optionalString,
    OPENCLAW_API_KEY: optionalString,
  });

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function normalizeHttpBaseUrl(value) {
  return trimTrailingSlash(String(value ?? "").trim())
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");
}

export function getOpenClawConfig(overrides = {}) {
  const rawEnvironment = openClawEnvironmentSchema.parse(process.env);
  const baseUrl = normalizeHttpBaseUrl(overrides.baseUrl ?? rawEnvironment.OPENCLAW_BASE_URL ?? "");
  const model = String(overrides.model ?? rawEnvironment.OPENCLAW_MODEL ?? "").trim();
  const timeoutMs = parsePositiveInteger(
    overrides.timeoutMs ?? rawEnvironment.OPENCLAW_TIMEOUT_MS,
    8000,
  );
  const apiKey = String(overrides.apiKey ?? rawEnvironment.OPENCLAW_API_KEY ?? "").trim();

  return {
    baseUrl,
    model,
    timeoutMs,
    apiKey,
  };
}

export function assertOpenClawConfig(overrides = {}) {
  const config = getOpenClawConfig(overrides);

  if (!config.baseUrl) {
    throw new Error("OPENCLAW_BASE_URL is required to use OpenClaw.");
  }

  if (!config.model) {
    throw new Error("OPENCLAW_MODEL is required to use OpenClaw.");
  }

  return config;
}

export function isOpenClawConfigurationError(error) {
  return error instanceof Error && /^OPENCLAW_(BASE_URL|MODEL) is required/.test(error.message);
}
