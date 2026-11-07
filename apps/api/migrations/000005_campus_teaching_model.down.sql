DROP INDEX IF EXISTS uq_assignments_teacher_active_class;
DROP INDEX IF EXISTS uq_assignments_teacher_active_subject;
DROP INDEX IF EXISTS idx_users_teacher_subject;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subject_teacher_only;
ALTER TABLE users DROP COLUMN IF EXISTS subject_id;
DROP INDEX IF EXISTS uq_users_classroom_per_active_class;