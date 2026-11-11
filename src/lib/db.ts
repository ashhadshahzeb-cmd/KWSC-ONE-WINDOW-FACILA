import Dexie, { Table } from 'dexie';

export interface AppConfigItem {
  id?: string;
  config_type: string;
  config_key: string;
  config_label: string;
  parent_key: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface FileRecord {
  id?: string; // Supabase UUID
  cfo_diary_number: string;
  receiving_number: string;
  inward_date?: string;
  received_from?: string;
  main_category?: string;
  sub_category?: string;
  emp_no?: string;
  cnic?: string;
  emp_name?: string;
  party_name?: string;
  voucher_code?: string;
  vehicle_no?: string;
  subject?: string;
  handover_person_name?: string;
  file_purpose?: string;
  amount?: number;
  status?: string;
  mark_to?: string;
  history?: any[];
  registration_date?: string;
  print_date?: string;
  department_number?: string;
  additional_mark_to?: string;
  fuel_station?: string;
  file_image?: string; // base64 compressed JPEG of document photo
  file_images?: string[]; // Multiple document photos / scans
  // Local only fields for syncing
  is_dirty?: boolean; // Flag indicating it needs sync
  deleted_locally?: boolean; // Flag indicating it was deleted offline
}

export interface PendingFileRecord {
  id?: string; // Supabase UUID
  tracking_code: string;
  category: string;
  subject?: string;
  file_image?: string;
  file_images?: string[];
  status: string; // 'pending' | 'completed'
  created_at?: string;
  completed_at?: string;
  // Local only fields for syncing
  is_dirty?: boolean;
}

export interface SyncTask {
  id?: number;
  action: 'insert' | 'update' | 'delete';
  table: string;
  payload: any;
  record_id?: string; // e.g. receiving_number
  created_at: string;
  status: 'pending' | 'failed' | 'processing';
  error_message?: string;
  retry_count: number;
}

export class KWSCAppDatabase extends Dexie {
  configs!: Table<AppConfigItem>;
  records!: Table<FileRecord>;
  pendingFiles!: Table<PendingFileRecord>;
  syncQueue!: Table<SyncTask>;

  constructor() {
    super('KWSC_OneWindow_DB');
    this.version(1).stores({
      // We use config_key as unique index for fast lookup
      configs: 'id, config_type, config_key, parent_key',
      
      // cfo_diary_number and receiving_number should be searchable
      records: 'id, cfo_diary_number, receiving_number, mark_to, status, inward_date, main_category',
      
      // syncQueue needs to be processed chronologically
      syncQueue: '++id, action, status, created_at, table, record_id'
    });
    // Version 2: Added file_image field (no index change needed, just data shape)
    this.version(2).stores({
      configs: 'id, config_type, config_key, parent_key',
      records: 'id, cfo_diary_number, receiving_number, mark_to, status, inward_date, main_category',
      syncQueue: '++id, action, status, created_at, table, record_id'
    });
    // Version 3: Added pendingFiles table
    this.version(3).stores({
      configs: 'id, config_type, config_key, parent_key',
      records: 'id, cfo_diary_number, receiving_number, mark_to, status, inward_date, main_category',
      pendingFiles: 'id, tracking_code, status',
      syncQueue: '++id, action, status, created_at, table, record_id'
    });
  }
}

export const db = new KWSCAppDatabase();

