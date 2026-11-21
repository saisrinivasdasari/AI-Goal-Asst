import { z } from "zod";

const envSchema = z.object({
  // Supabase Database Connection
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase Auth & Public Keys
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Ollama Local Inference
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  DEFAULT_CHAT_MODEL: z.string().default("qwen3:4b"),
  DEFAULT_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  OLLAMA_NUM_CTX: z.coerce.number().default(4096),

  // Node runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  DEFAULT_CHAT_MODEL: process.env.DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL: process.env.DEFAULT_EMBEDDING_MODEL,
  OLLAMA_NUM_CTX: process.env.OLLAMA_NUM_CTX,
  NODE_ENV: process.env.NODE_ENV,
});

