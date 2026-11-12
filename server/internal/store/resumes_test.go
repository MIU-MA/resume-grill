package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestConcurrentSnapshotsDoNotOverwriteOrCrossOwners(t *testing.T) {
	s, _ := openTestStore(t)
	type result struct {
		owner    string
		document Resume
		err      error
	}
	completed := make(chan result, 32)
	for index := 0; index < 32; index++ {
		owner := "alice"
		if index%2 == 1 {
			owner = "bob"
		}
		go func(owner string) {
			document, err := s.CreateResume(context.Background(), owner, "简历.pdf", owner+" 的正文")
			completed <- result{owner, document, err}
		}(owner)
	}
	ids := map[string]bool{}
	for index := 0; index < 32; index++ {
		entry := <-completed
		if entry.err != nil {
			t.Fatal(entry.err)
		}
		if ids[entry.document.ID] {
			t.Fatal("snapshot overwritten")
		}
		ids[entry.document.ID] = true
	}
	for _, owner := range []string{"alice", "bob"} {
		documents, err := s.ListResumes(context.Background(), owner)
		if err != nil || len(documents) != 16 {
			t.Fatalf("%s: %d snapshots, %v", owner, len(documents), err)
		}
		for _, document := range documents {
			stored, err := s.GetResume(context.Background(), owner, document.ID)
			if err != nil || stored.RawText != owner+" 的正文" {
				t.Fatal("cross-owner content or failed read")
			}
		}
	}
}

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
