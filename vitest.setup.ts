// Any setup scripts you might need go here

// Load .env files (.env.local first — Next.js precedence)
import dotenv from 'dotenv'
dotenv.config({ path: ['.env.local', '.env'] })
