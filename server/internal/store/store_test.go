package store

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func openTestStore(t *testing.T) (*Store, string) {
	t.Helper()
	// Exercise paths containing both spaces and characters that need URI escaping.
	path := filepath.Join(t.TempDir(), "简历 #1", "workbench.db")
	s, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s, path
}

func execSQL(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func TestDatabaseConfiguration(t *testing.T) {
	s, _ := openTestStore(t)
	for _, db := range []*sql.DB{s.writer, s.reader} {
		var journal string
		if err := db.QueryRow("PRAGMA journal_mode").Scan(&journal); err != nil {
			t.Fatal(err)
		}
		if journal != "wal" {
			t.Fatalf("journal = %q", journal)
		}
		for pragma, want := range map[string]int{"foreign_keys": 1, "busy_timeout": 5000} {
			var got int
			if err := db.QueryRow("PRAGMA " + pragma).Scan(&got); err != nil {
				t.Fatal(err)
			}
			if got != want {
				t.Fatalf("%s = %d; want %d", pragma, got, want)
			}
		}
	}
	if _, err := s.reader.Exec("INSERT INTO owners(id) VALUES ('forbidden')"); err == nil {
		t.Fatal("read pool accepted a write")
	}
}

func TestMigrationPreservesDocumentsOnReopen(t *testing.T) {
	s, path := openTestStore(t)
	execSQL(t, s.writer, "INSERT INTO owners(id) VALUES ('local')")
	execSQL(t, s.writer, `INSERT INTO resume_documents(owner_id,id,source_name,raw_text,created_at,updated_at)
        VALUES ('local','resume','原简历.pdf','真实简历文本',1,1)`)
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	var text string
	if err := reopened.reader.QueryRow("SELECT raw_text FROM resume_documents WHERE owner_id='local' AND id='resume'").Scan(&text); err != nil {
		t.Fatal(err)
	}
	if text != "真实简历文本" {
		t.Fatalf("unexpected text %q", text)
	}
	var count int
	if err := reopened.reader.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("migration applied %d times", count)
	}
}

func TestVersionRelationshipsStayWithinOwner(t *testing.T) {
	s, _ := openTestStore(t)
	execSQL(t, s.writer, "INSERT INTO owners(id) VALUES ('alice'),('bob')")
	insert := `INSERT INTO resume_documents(owner_id,id,source_name,raw_text,parent_id,created_at,updated_at)
        VALUES (?,?,'简历.pdf','内容',?,1,1)`
	execSQL(t, s.writer, insert, "alice", "original", nil)
	execSQL(t, s.writer, insert, "alice", "tailored", "original")
	if _, err := s.writer.Exec(insert, "bob", "tailored", "original"); err == nil {
		t.Fatal("accepted another owner's parent document")
	}
	execSQL(t, s.writer, insert, "bob", "original", nil)
	execSQL(t, s.writer, insert, "bob", "tailored", "original")
	if _, err := s.writer.Exec("DELETE FROM resume_documents WHERE owner_id='alice' AND id='original'"); err == nil {
		t.Fatal("deleted the parent of a saved version")
	}
}

func TestFailedMigrationRollsBackAllSchemaChanges(t *testing.T) {
	path := filepath.Join(t.TempDir(), "conflict.db")
	raw, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	execSQL(t, raw, "CREATE TABLE resume_documents (existing TEXT)")
	execSQL(t, raw, "INSERT INTO resume_documents VALUES ('keep')")
	s, err := Open(context.Background(), path)
	if err == nil {
		_ = s.Close()
		t.Fatal("expected conflicting migration to fail")
	}
	var count int
	if err := raw.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('owners','schema_migrations')").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("failed migration left a partial schema")
	}
	var existing string
	if err := raw.QueryRow("SELECT existing FROM resume_documents").Scan(&existing); err != nil {
		t.Fatal(err)
	}
	if existing != "keep" {
		t.Fatal("existing data changed")
	}
}

func TestRejectNewerSchema(t *testing.T) {
	s, path := openTestStore(t)
	execSQL(t, s.writer, "INSERT INTO schema_migrations(version) VALUES (?)", SchemaVersion+1)
	_ = s.Close()
	newer, err := Open(context.Background(), path)
	if err == nil {
		_ = newer.Close()
		t.Fatal("accepted a newer schema")
	}
	if !strings.Contains(err.Error(), "newer than supported") {
		t.Fatal(err)
	}
}

func TestClosedDatabaseIsNotReady(t *testing.T) {
	s, _ := openTestStore(t)
	_ = s.Close()
	if err := s.Check(context.Background()); err == nil {
		t.Fatal("closed database reported ready")
	}
}

func TestSchemaVersionAloneDoesNotMakeDatabaseReady(t *testing.T) {
	for _, statement := range []string{"DROP TABLE resume_documents", "DROP TABLE owners", "ALTER TABLE resume_documents RENAME COLUMN raw_text TO wrong_column"} {
		t.Run(statement, func(t *testing.T) {
			s, path := openTestStore(t)
			execSQL(t, s.writer, statement)
			if err := s.Check(context.Background()); err == nil {
				t.Fatal("broken schema reported ready")
			}
			_ = s.Close()
			reopened, err := Open(context.Background(), path)
			if err == nil {
				_ = reopened.Close()
				t.Fatal("startup accepted a broken schema")
			}
		})
	}
}

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
