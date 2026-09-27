import * as migration_20260919_140148_initial from './20260919_140148_initial';
import * as migration_20260919_142047_member_files_negotiation from './20260919_142047_member_files_negotiation';
import * as migration_20260919_160000_wg_status_appeal_guard from './20260919_160000_wg_status_appeal_guard';
import * as migration_20260919_170000_push_endpoint_unique from './20260919_170000_push_endpoint_unique';
import * as migration_20260919_180000_notification_outbox_publish_state from './20260919_180000_notification_outbox_publish_state';
import * as migration_20260919_190000_wg_activities_content_drafts_trust_note from './20260919_190000_wg_activities_content_drafts_trust_note';
import * as migration_20260927_120000_decision_engine from './20260927_120000_decision_engine';
import * as migration_20260927_123000_decision_locked_rels from './20260927_123000_decision_locked_rels';
import * as migration_20260927_130000_governance_elections_selections from './20260927_130000_governance_elections_selections';
import * as migration_20260927_140000_handovers from './20260927_140000_handovers'
import * as migration_20260927_150000_operations from './20260927_150000_operations';

export const migrations = [
  {
    up: migration_20260919_140148_initial.up,
    down: migration_20260919_140148_initial.down,
    name: '20260919_140148_initial',
  },
  {
    up: migration_20260919_142047_member_files_negotiation.up,
    down: migration_20260919_142047_member_files_negotiation.down,
    name: '20260919_142047_member_files_negotiation'
  },
  {
    up: migration_20260919_160000_wg_status_appeal_guard.up,
    down: migration_20260919_160000_wg_status_appeal_guard.down,
    name: '20260919_160000_wg_status_appeal_guard'
  },
  {
    up: migration_20260919_170000_push_endpoint_unique.up,
    down: migration_20260919_170000_push_endpoint_unique.down,
    name: '20260919_170000_push_endpoint_unique'
  },
  {
    up: migration_20260919_180000_notification_outbox_publish_state.up,
    down: migration_20260919_180000_notification_outbox_publish_state.down,
    name: '20260919_180000_notification_outbox_publish_state'
  },
  {
    up: migration_20260919_190000_wg_activities_content_drafts_trust_note.up,
    down: migration_20260919_190000_wg_activities_content_drafts_trust_note.down,
    name: '20260919_190000_wg_activities_content_drafts_trust_note'
  },
  {
    up: migration_20260927_120000_decision_engine.up,
    down: migration_20260927_120000_decision_engine.down,
    name: '20260927_120000_decision_engine'
  },
  {
    up: migration_20260927_123000_decision_locked_rels.up,
    down: migration_20260927_123000_decision_locked_rels.down,
    name: '20260927_123000_decision_locked_rels'
  },
  {
    up: migration_20260927_130000_governance_elections_selections.up,
    down: migration_20260927_130000_governance_elections_selections.down,
    name: '20260927_130000_governance_elections_selections'
  },
  {
    up: migration_20260927_140000_handovers.up,
    down: migration_20260927_140000_handovers.down,
    name: '20260927_140000_handovers'
  },
];
