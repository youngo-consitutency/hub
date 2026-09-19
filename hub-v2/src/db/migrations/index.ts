import * as migration_20260919_140148_initial from './20260919_140148_initial';
import * as migration_20260919_142047_member_files_negotiation from './20260919_142047_member_files_negotiation';
import * as migration_20260919_160000_wg_status_appeal_guard from './20260919_160000_wg_status_appeal_guard';
import * as migration_20260919_170000_push_endpoint_unique from './20260919_170000_push_endpoint_unique';
import * as migration_20260919_180000_notification_outbox_publish_state from './20260919_180000_notification_outbox_publish_state';

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
];
