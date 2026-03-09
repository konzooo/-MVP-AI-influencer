/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai_brainstorm from "../ai/brainstorm.js";
import type * as ai_generate from "../ai/generate.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as imageStorage from "../imageStorage.js";
import type * as instagramAuth from "../instagramAuth.js";
import type * as internalDb from "../internalDb.js";
import type * as migrations_migrateReferenceImages from "../migrations/migrateReferenceImages.js";
import type * as posts from "../posts.js";
import type * as referenceImages from "../referenceImages.js";
import type * as settings from "../settings.js";
import type * as taskRunner from "../taskRunner.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "ai/brainstorm": typeof ai_brainstorm;
  "ai/generate": typeof ai_generate;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  imageStorage: typeof imageStorage;
  instagramAuth: typeof instagramAuth;
  internalDb: typeof internalDb;
  "migrations/migrateReferenceImages": typeof migrations_migrateReferenceImages;
  posts: typeof posts;
  referenceImages: typeof referenceImages;
  settings: typeof settings;
  taskRunner: typeof taskRunner;
  tasks: typeof tasks;
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

export declare const components: {};
