CREATE TABLE `model_pricing` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`provider` text NOT NULL,
	`input_price_per_1k` real NOT NULL,
	`output_price_per_1k` real NOT NULL,
	`last_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_pricing_model_id_provider_unique` ON `model_pricing` (`model_id`,`provider`);--> statement-breakpoint
ALTER TABLE `runs` ADD `total_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `runs` ADD `model_settings` text;--> statement-breakpoint
ALTER TABLE `tool_executions` ADD `reasoning` text;--> statement-breakpoint
ALTER TABLE `turns` ADD `started_at` integer;--> statement-breakpoint
ALTER TABLE `turns` ADD `duration_ms` integer;