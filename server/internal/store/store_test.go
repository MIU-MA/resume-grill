package store

import (
	"context"
	"database/sql"
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
