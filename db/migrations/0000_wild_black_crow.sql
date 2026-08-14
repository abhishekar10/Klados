CREATE TABLE `completion_log` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`child_id` text,
	`completed` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `completion_log_goal_id_idx` ON `completion_log` (`goal_id`);--> statement-breakpoint
CREATE INDEX `completion_log_date_idx` ON `completion_log` (`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`description` text,
	`is_complete` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`lifecycle_state` text DEFAULT 'active' NOT NULL,
	`state_changed_at` integer NOT NULL,
	`schedule_type` text DEFAULT 'one-shot' NOT NULL,
	`time_of_day` text,
	`range_start` text,
	`range_end` text,
	`cycle_pattern` text,
	`cycle_started_at` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_parent_id_idx` ON `goals` (`parent_id`);