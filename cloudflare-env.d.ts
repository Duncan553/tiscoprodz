/// <reference types="@cloudflare/workers-types" />

// Pulls in D1Database, R2Bucket, R2Object and the rest of the Workers runtime
// types. Without this, `env().DB` is typed as `any` and a wrong query shape only
// shows up at runtime, in production, on someone's payment.
