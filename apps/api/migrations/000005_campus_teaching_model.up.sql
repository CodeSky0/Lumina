-- 校园组织约束：
-- 1) 每个班级同一时间只允许一个启用的大屏账号；
-- 2) 每位教师归属唯一科目，可在多个班级授课。

WITH ranked_classrooms AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY id) AS position
    FROM users
    WHERE role = 'classroom' AND active = TRUE
)
UPDATE users
SET active = FALSE, updated_at = NOW()
FROM ranked_classrooms
WHERE users.id = ranked_classrooms.id AND ranked_classrooms.position > 1;

CREATE UNIQUE INDEX uq_users_classroom_per_active_class
    ON users(class_id)
    WHERE role = 'classroom' AND active;

ALTER TABLE users ADD COLUMN subject_id BIGINT REFERENCES subjects(id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_subject_teacher_only
    CHECK (subject_id IS NULL OR role = 'teacher');

WITH counted AS (
    SELECT teacher_id, subject_id, COUNT(*) AS task_count
    FROM teaching_assignments
    WHERE active = TRUE
    GROUP BY teacher_id, subject_id
), ranked AS (
    SELECT teacher_id, subject_id,
           ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY task_count DESC, subject_id ASC) AS position
    FROM counted
)
UPDATE users
SET subject_id = ranked.subject_id
FROM ranked
WHERE users.id = ranked.teacher_id
  AND ranked.position = 1
  AND users.role = 'teacher'
  AND users.subject_id IS NULL;

-- 历史数据如果存在同一教师多科目任务，保留主科目对应的任务与通道。
UPDATE channels
SET active = FALSE, updated_at = NOW()
FROM teaching_assignments AS assignments
JOIN users ON users.id = assignments.teacher_id
WHERE assignments.active = TRUE
  AND users.subject_id IS NOT NULL
  AND assignments.subject_id <> users.subject_id
  AND channels.type = 'normal'
  AND channels.teacher_id = assignments.teacher_id
  AND channels.class_id = assignments.class_id
  AND channels.subject_id = assignments.subject_id;

UPDATE teaching_assignments
SET active = FALSE, updated_at = NOW()
FROM users
WHERE users.id = teaching_assignments.teacher_id
  AND teaching_assignments.active = TRUE
  AND users.subject_id IS NOT NULL
  AND teaching_assignments.subject_id <> users.subject_id;

CREATE INDEX idx_users_teacher_subject ON users(subject_id) WHERE role = 'teacher';
CREATE UNIQUE INDEX uq_assignments_teacher_active_subject ON teaching_assignments(teacher_id, subject_id) WHERE active;
CREATE UNIQUE INDEX uq_assignments_teacher_active_class ON teaching_assignments(teacher_id, class_id) WHERE active;