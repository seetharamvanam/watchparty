CREATE TABLE "rate_limit_buckets" (
	"bucket_key" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bucket_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_key_created_idx" ON "rate_limit_events" USING btree ("bucket_key","created_at");