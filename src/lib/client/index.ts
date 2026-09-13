import { createHttpApi } from "@/lib/client/http";
import { createMockApi } from "@/lib/client/mock";
import { isMockApi } from "@/lib/client/config";
import type { WatchPartyApi } from "@/lib/client/api-types";

let cached: WatchPartyApi | null = null;

export function getApi(): WatchPartyApi {
  if (cached) return cached;
  cached = isMockApi() ? createMockApi() : createHttpApi();
  return cached;
}

export type { WatchPartyApi } from "@/lib/client/api-types";
