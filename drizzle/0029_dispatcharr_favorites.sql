CREATE TABLE "dispatcharr_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" varchar(32) NOT NULL,
	"channel_uuid" varchar(64) NOT NULL,
	"channel_id" varchar(32) NOT NULL,
	"channel_name" varchar(255) NOT NULL,
	"channel_number" varchar(20),
	"logo_id" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dispatcharr_favorites_sort_order_idx" ON "dispatcharr_favorites" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "dispatcharr_favorites_instance_channel_idx" ON "dispatcharr_favorites" USING btree ("instance_id","channel_uuid");
