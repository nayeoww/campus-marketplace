/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
import type * as listings from "../listings.js";
import type * as messaging from "../messaging.js";
import type * as mojoOtp from "../mojoOtp.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as sms from "../sms.js";
import type * as users from "../users.js";

const fullApi: ApiFromModules<{
  "listings": typeof listings,
"messaging": typeof messaging,
"mojoOtp": typeof mojoOtp,
"profiles": typeof profiles,
"seed": typeof seed,
"sms": typeof sms,
"users": typeof users,
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;
