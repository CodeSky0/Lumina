package services

import (
	"net/http"
	"testing"
)

func TestUploadMIMERules(t *testing.T) {
	png := http.DetectContentType([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0})
	if err := validateMIME(".png", "image", png, "image/png"); err != nil {
		t.Fatalf("合法 PNG 被拒绝: %v", err)
	}
	if err := validateMIME(".png", "image", "image/jpeg", "image/jpeg"); err == nil {
		t.Fatal("伪造扩展名的图片必须被拒绝")
	}
	if err := validateMIME(".exe", "file", "application/octet-stream", "application/octet-stream"); err == nil { // 扩展名白名单在 Upload 中执行；这里确保不会将 exe 误当已知类型。
		if _, allowed := uploadKinds[".exe"]; allowed {
			t.Fatal("可执行文件不应在白名单中")
		}
	}
	if _, allowed := uploadKinds[".exe"]; allowed {
		t.Fatal("可执行文件不应允许上传")
	}
}

func TestUploadSizeBoundaries(t *testing.T) {
	if MaxImageSize != 5*1024*1024 || MaxFileSize != 20*1024*1024 {
		t.Fatal("上传大小不符合契约")
	}
}
