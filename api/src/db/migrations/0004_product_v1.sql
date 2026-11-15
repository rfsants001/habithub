ALTER TABLE `habits` ADD `days_per_week` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
CREATE INDEX `entries_habit_date_idx` ON `entries` (`habit_id`,`date`);