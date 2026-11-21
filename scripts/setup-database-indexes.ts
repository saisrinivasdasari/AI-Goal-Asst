import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up pgvector HNSW index and hybrid search function on Supabase...");

  // 1. Ensure extensions exist
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  console.log("✅ PostgreSQL extensions verified.");

  // 2. Create HNSW Cosine vector index on universal_memories
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_universal_memories_embedding_hnsw 
    ON universal_memories 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `);
  console.log("✅ HNSW vector cosine index created.");

  // 3. Add generated tsvector column for keyword search
  await prisma.$executeRawUnsafe(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'universal_memories' AND column_name = 'fts_tokens'
      ) THEN 
        ALTER TABLE universal_memories 
        ADD COLUMN fts_tokens tsvector 
        GENERATED ALWAYS AS (to_tsvector('english', topic || ' ' || content)) STORED;
      END IF;
    END $$;
  `);
  console.log("✅ Full-text search tsvector column created.");

  // 4. Create GIN index for full-text search
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_universal_memories_fts 
    ON universal_memories 
    USING gin (fts_tokens);
  `);
  console.log("✅ GIN full-text index created.");

  // 5. Create match_memories_hybrid stored procedure (Reciprocal Rank Fusion)
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION match_memories_hybrid(
      query_text text,
      query_embedding vector(768),
      match_count int DEFAULT 5,
      filter_user_id text DEFAULT NULL
    )
    RETURNS TABLE (
      id text,
      topic text,
      content text,
      memory_type "MemoryType",
      combined_score float8
    )
    LANGUAGE sql
    STABLE
    AS $$
      WITH vector_search AS (
        SELECT 
          m.id,
          ROW_NUMBER() OVER (ORDER BY m.embedding <=> query_embedding) as rank
        FROM universal_memories m
        WHERE (filter_user_id IS NULL OR m."userId" = filter_user_id)
          AND m.embedding IS NOT NULL
        LIMIT match_count * 2
      ),
      text_search AS (
        SELECT 
          m.id,
          ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.fts_tokens, websearch_to_tsquery('english', query_text)) DESC) as rank
        FROM universal_memories m
        WHERE (filter_user_id IS NULL OR m."userId" = filter_user_id)
          AND m.fts_tokens @@ websearch_to_tsquery('english', query_text)
        LIMIT match_count * 2
      )
      SELECT 
        m.id,
        m.topic,
        m.content,
        m.type as memory_type,
        COALESCE(1.0 / (60 + v.rank), 0.0) + COALESCE(1.0 / (60 + t.rank), 0.0) AS combined_score
      FROM universal_memories m
      LEFT JOIN vector_search v ON m.id = v.id
      LEFT JOIN text_search t ON m.id = t.id
      WHERE v.id IS NOT NULL OR t.id IS NOT NULL
      ORDER BY combined_score DESC
      LIMIT match_count;
    $$;
  `);
  console.log("✅ Hybrid search (Reciprocal Rank Fusion) function created.");
  console.log("🎉 All database extensions and indexes configured successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

