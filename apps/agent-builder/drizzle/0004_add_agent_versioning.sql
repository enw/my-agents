-- Add versioning columns to runs table
ALTER TABLE runs ADD COLUMN prompt_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE runs ADD COLUMN memory_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN memory_hash TEXT;
ALTER TABLE runs ADD COLUMN agent_version TEXT;

-- Create indexes for querying by version
CREATE INDEX idx_runs_agent_version ON runs(agent_version);
CREATE INDEX idx_runs_prompt_version ON runs(prompt_version);

