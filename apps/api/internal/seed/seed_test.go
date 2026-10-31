package seed

import "testing"

func TestAssignmentIndexesCoverAllClassesWithUniqueMappings(t *testing.T) {
	type assignmentKey struct{ teacher, class, subject int }
	unique := map[assignmentKey]bool{}
	classes := map[int]bool{}
	teacherClasses := map[int]map[int]bool{}
	for i := 0; i < 300; i++ {
		teacher, class, subject := assignmentIndexes(i)
		key := assignmentKey{teacher: teacher, class: class, subject: subject}
		if unique[key] {
			t.Fatalf("任务唯一约束冲突: %+v", key)
		}
		unique[key] = true
		classes[class] = true
		if teacherClasses[teacher] == nil {
			teacherClasses[teacher] = map[int]bool{}
		}
		teacherClasses[teacher][class] = true
	}
	if len(unique) != 300 || len(classes) != 20 || len(teacherClasses) != 50 {
		t.Fatalf("覆盖数量错误: tasks=%d classes=%d teachers=%d", len(unique), len(classes), len(teacherClasses))
	}
	for teacher, assigned := range teacherClasses {
		if len(assigned) != 6 {
			t.Fatalf("教师 %d 覆盖 %d 个不同班级，期望 6", teacher, len(assigned))
		}
	}
}
