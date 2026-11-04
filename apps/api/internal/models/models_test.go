package models

import (
	"encoding/json"
	"testing"
)

func TestIDAcceptsStringAndRejectsInvalidValues(t *testing.T) {
	var payload struct {
		ID ID `json:"id"`
	}
	if err := json.Unmarshal([]byte(`{"id":"9007199254740993"}`), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.ID.String() != "9007199254740993" {
		t.Fatalf("ID 解析错误: %v", payload.ID)
	}
	if err := json.Unmarshal([]byte(`{"id":0}`), &payload); err == nil {
		t.Fatal("零 ID 必须被拒绝")
	}
}

func TestIDScanAcceptsRedisString(t *testing.T) {
	var id ID
	if err := id.Scan("42"); err != nil {
		t.Fatal(err)
	}
	if id != 42 {
		t.Fatalf("Redis 字符串 ID 解析为 %d，期望 42", id)
	}
}

func TestFileObjectUsesFilesTable(t *testing.T) {
	if table := (FileObject{}).TableName(); table != "files" {
		t.Fatalf("FileObject 表名为 %q，期望 files", table)
	}
}
