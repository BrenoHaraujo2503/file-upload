CREATE TABLE "files" (
	"id" text,
	"name" text,
	"key" text,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
