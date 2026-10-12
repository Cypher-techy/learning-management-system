import { config } from "dotenv";

// Same precedence as Next.js: .env.local overrides .env. An explicitly set
// process variable (for example DATABASE_URL in CI) always wins.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
