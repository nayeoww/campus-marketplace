import { defineApp } from "convex/server";
import betterAuthComponent from "@convex-dev/better-auth/convex.config";

/**
 * Better Auth runs here as an OTP *verifier* only — it owns the code lifecycle
 * for sign-in, while Convex Auth keeps owning users and sessions. Registering
 * the component is what gives us `components.betterAuth` and its storage.
 */
const app = defineApp();

app.use(betterAuthComponent);

export default app;
