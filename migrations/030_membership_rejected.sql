-- Membership Team can reject an application without using terminated.
-- rejected is a closed state: Hub access is suspended, like expired/terminated.

ALTER TABLE hub_accounts
  DROP CONSTRAINT IF EXISTS hub_accounts_membership_status_check;

ALTER TABLE hub_accounts
  ADD CONSTRAINT hub_accounts_membership_status_check
  CHECK (
    membership_status IN (
      'registered',
      'course_passed',
      'awaiting_onboarding',
      'active',
      'renewal_due',
      'expired',
      'terminated',
      'rejected'
    )
  );
