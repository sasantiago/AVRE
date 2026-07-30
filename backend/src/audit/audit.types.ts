export interface RecordAuditEntryInput {
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

// Interfaz (Open/Closed): cualquier módulo futuro consume IAuditRecorder sin conocer
// la implementación concreta. Hoy solo hay una (AuditService), pero el punto de
// extensión ya existe.
export interface IAuditRecorder {
  record(input: RecordAuditEntryInput): Promise<void>;
}

export const AUDIT_RECORDER = Symbol('AUDIT_RECORDER');
