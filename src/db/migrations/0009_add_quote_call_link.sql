-- Add call linkage to quotes table (for quotes started during a live call)
ALTER TABLE quotes ADD COLUMN call_id uuid REFERENCES calls(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN az_ticket_note_posted boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN az_ticket_note_error text;

-- Index for the transcript worker to find pending quote-ticket links
CREATE INDEX quotes_pending_ticket_link_idx ON quotes (call_id) WHERE call_id IS NOT NULL AND az_ticket_note_posted = false;
