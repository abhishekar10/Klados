CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`indicator_style` text DEFAULT 'ring' NOT NULL,
	`show_archived` integer DEFAULT false NOT NULL,
	`stale_days` integer DEFAULT 14 NOT NULL,
	`due_soon_hours` integer DEFAULT 2 NOT NULL
);
