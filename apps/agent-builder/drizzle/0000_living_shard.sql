CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`system_prompt` text NOT NULL,
	`default_model` text NOT NULL,
	`allowed_tools` text NOT NULL,
	`tags` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`provider` text NOT NULL,
	`latency_ms` integer NOT NULL,
	`tokens_per_second` real,
	`quality_rating` integer,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`model_used` text NOT NULL,
	`status` text NOT NULL,
	`total_input_tokens` integer DEFAULT 0 NOT NULL,
	`total_output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`total_tool_calls` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`error` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tool_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`parameters` text NOT NULL,
	`success` integer NOT NULL,
	`output` text NOT NULL,
	`data` text,
	`error` text,
	`execution_time_ms` integer NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`turn_number` integer NOT NULL,
	`user_message` text NOT NULL,
	`assistant_message` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
