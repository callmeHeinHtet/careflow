-- Audit records are append-only. Normal UPDATE and DELETE statements fail at the database boundary.
CREATE OR REPLACE FUNCTION careflow_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are immutable';
END;
$$;

CREATE TRIGGER "AuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW
EXECUTE FUNCTION careflow_reject_audit_mutation();
