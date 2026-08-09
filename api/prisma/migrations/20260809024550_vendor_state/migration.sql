-- Coarse location for the marketplace filter. Area stays as the neighbourhood
-- shown to customers; state is what they filter on.
-- Defaults to Lagos: every existing vendor trades there.
ALTER TABLE "vendors" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'Lagos';
