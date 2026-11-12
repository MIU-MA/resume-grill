package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSnapshotsSurviveRestartAndStayIsolated(t *testing.T) {
	s, path := openTestStore(t)
	ctx := context.Background()
	original, err := s.CreateResume(ctx, "alice", "原简历.pdf", "姓名\nGo / SQL 项目")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateResume(ctx, "bob", "另一份简历.pdf", "私有内容"); err != nil {
		t.Fatal(err)
	}
	if _, err = s.GetResume(ctx, "bob", original.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-owner read: %v", err)
	}
	list, err := s.ListResumes(ctx, "alice")
	if err != nil || len(list) != 1 || list[0].ID != original.ID || list[0].RawText != "" {
		t.Fatalf("list leaked data: %v %v", list, err)
	}
	_ = s.Close()
	reopened, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	saved, err := reopened.GetResume(ctx, "alice", original.ID)
	if err != nil || saved != original {
		t.Fatalf("restart changed snapshot: %v %v", saved, err)
	}
}

func TestSnapshotsRejectInvalidContentWithoutCreatingOwner(t *testing.T) {
	s, _ := openTestStore(t)
	for _, input := range [][2]string{{"", "内容"}, {"简历", " "}, {strings.Repeat("字", 513), "内容"}, {"简历", strings.Repeat("字", 400000)}} {
		if _, err := s.CreateResume(context.Background(), "new-owner", input[0], input[1]); !errors.Is(err, ErrInvalidResume) {
			t.Fatalf("accepted invalid input: %v", err)
		}
	}
	var count int
	if err := s.reader.QueryRow("SELECT COUNT(*) FROM owners").Scan(&count); err != nil || count != 0 {
		t.Fatal("invalid input modified owner table")
	}
}

func TestFailedSnapshotWriteDoesNotLeaveOwner(t *testing.T) {
	s, _ := openTestStore(t)
	execSQL(t, s.writer, `CREATE TRIGGER fail_snapshot BEFORE INSERT ON resume_documents BEGIN SELECT RAISE(ABORT,'test failure'); END`)
	if _, err := s.CreateResume(context.Background(), "new-owner", "简历", "内容"); err == nil {
		t.Fatal("expected write failure")
	}
	var count int
	if err := s.reader.QueryRow("SELECT COUNT(*) FROM owners").Scan(&count); err != nil || count != 0 {
		t.Fatal("failed write left a partial transaction")
	}
}
