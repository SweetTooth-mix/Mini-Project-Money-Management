ALTER TABLE "Document" ADD CONSTRAINT "document_amount_positive"
  CHECK ("amountSen" > 0 AND "amountSen" <= 999999999999);
ALTER TABLE "Document" ADD CONSTRAINT "independent_approval"
  CHECK ("approvedById" IS NULL OR "approvedById" <> "createdById");
ALTER TABLE "Document" ADD CONSTRAINT "approved_document_has_reviewer"
  CHECK ("status" NOT IN ('APPROVED', 'PAID') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "Document" ADD CONSTRAINT "paid_document_has_date"
  CHECK ("status" <> 'PAID' OR "paidAt" IS NOT NULL);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "entry_amount_sign"
  CHECK (("type" IN ('INCOME', 'OPENING', 'TRANSFER_IN') AND "amountSen" > 0)
    OR ("type" IN ('EXPENSE', 'TRANSFER_OUT') AND "amountSen" < 0)
    OR ("type" = 'REVERSAL' AND "amountSen" <> 0));
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "reversal_has_original"
  CHECK (("type" = 'REVERSAL') = ("reversalOfId" IS NOT NULL));
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "transfer_has_group"
  CHECK (("type" IN ('TRANSFER_IN', 'TRANSFER_OUT')) = ("transferId" IS NOT NULL));
ALTER TABLE "Due" ADD CONSTRAINT "valid_due_period"
  CHECK ("month" BETWEEN 1 AND 12 AND "year" BETWEEN 1900 AND 9999 AND "amountSen" > 0);
ALTER TABLE "Due" ADD CONSTRAINT "paid_due_has_document"
  CHECK ("paidAt" IS NULL OR "documentId" IS NOT NULL);
ALTER TABLE "Member" ADD CONSTRAINT "positive_membership_fee" CHECK ("monthlySen" > 0);
CREATE UNIQUE INDEX "one_opening_per_account" ON "LedgerEntry" ("accountId") WHERE "type" = 'OPENING';

CREATE FUNCTION prevent_financial_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only. Use a reversal entry.';
END;
$$;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_history_change();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_history_change();

CREATE FUNCTION protect_submitted_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."amountSen" IS DISTINCT FROM OLD."amountSen" OR
    NEW."accountId" IS DISTINCT FROM OLD."accountId" OR
    NEW."fundId" IS DISTINCT FROM OLD."fundId" OR
    NEW."type" IS DISTINCT FROM OLD."type" OR
    NEW."date" IS DISTINCT FROM OLD."date" OR
    NEW."party" IS DISTINCT FROM OLD."party" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR
    NEW."category" IS DISTINCT FROM OLD."category" OR
    NEW."reference" IS DISTINCT FROM OLD."reference" OR
    NEW."paymentMethod" IS DISTINCT FROM OLD."paymentMethod" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById" OR
    NEW."number" IS DISTINCT FROM OLD."number"
  ) THEN
    RAISE EXCEPTION 'Submitted document financial details are immutable.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER document_protect_content BEFORE UPDATE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION protect_submitted_document();
