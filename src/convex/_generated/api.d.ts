/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as betterAuth from "../betterAuth.js";
import type * as email from "../email.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as listings from "../listings.js";
import type * as messaging from "../messaging.js";
import type * as otp from "../otp.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as sms from "../sms.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  betterAuth: typeof betterAuth;
  email: typeof email;
  helpers: typeof helpers;
  http: typeof http;
  listings: typeof listings;
  messaging: typeof messaging;
  otp: typeof otp;
  profiles: typeof profiles;
  seed: typeof seed;
  sms: typeof sms;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
