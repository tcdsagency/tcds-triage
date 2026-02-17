ALTER TYPE "renewal_candidate_status" ADD VALUE 'awaiting_az_ticket' BEFORE 'pending';
ALTER TABLE "renewal_candidates" ADD COLUMN "agencyzoom_sr_id" integer;
