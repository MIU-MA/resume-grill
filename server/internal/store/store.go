package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

const SchemaVersion = 1

type Store struct{ writer, reader *sql.DB }

func Open(ctx context.Context, path string) (_ *Store, err error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("resolve database path: %w", err)
	}
	if err = os.MkdirAll(filepath.Dir(absolute), 0700); err != nil {
		return nil, err
	}
	name := filepath.ToSlash(absolute)
	if filepath.VolumeName(absolute) != "" {
		name = "/" + name
	}
	uri := url.URL{Scheme: "file", Path: name}
	parameters := url.Values{"_pragma": {"foreign_keys(1)", "busy_timeout(5000)", "synchronous(NORMAL)"}}
	uri.RawQuery = parameters.Encode()
	writer, err := sql.Open("sqlite", uri.String())
	if err != nil {
		return nil, err
	}
	s := &Store{writer: writer}
	defer func() {
		if err != nil {
			_ = s.Close()
		}
	}()
	writer.SetMaxOpenConns(1)
	writer.SetMaxIdleConns(1)
	var mode string
	if err = writer.QueryRowContext(ctx, "PRAGMA journal_mode=WAL").Scan(&mode); err != nil {
		return nil, err
	}
	if mode != "wal" {
		return nil, fmt.Errorf("expected WAL journal, got %q", mode)
	}
	if err = s.migrate(ctx); err != nil {
		return nil, err
	}
	parameters.Set("mode", "ro")
	uri.RawQuery = parameters.Encode()
	s.reader, err = sql.Open("sqlite", uri.String())
	if err != nil {
		return nil, err
	}
	s.reader.SetMaxOpenConns(4)
	s.reader.SetMaxIdleConns(4)
	if err = s.Check(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate(ctx context.Context) error {
	tx, err := s.writer.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		return err
	}
	var version int
	if err = tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version); err != nil {
		return err
	}
	if version > SchemaVersion {
		return fmt.Errorf("database schema %d is newer than supported %d", version, SchemaVersion)
	}
	if version == 0 {
		migration, readErr := migrations.ReadFile("migrations/0001_resumes.sql")
		if readErr != nil {
			return readErr
		}
		if _, err = tx.ExecContext(ctx, string(migration)); err != nil {
			return fmt.Errorf("apply migration 1: %w", err)
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO schema_migrations(version) VALUES (?)", SchemaVersion); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) Check(ctx context.Context) error {
	var version int
	if err := s.reader.QueryRowContext(ctx, "SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version); err != nil {
		return err
	}
	if version != SchemaVersion {
		return fmt.Errorf("unexpected schema version %d", version)
	}
	// A version stamp alone cannot prove the business schema is usable.
	for _, query := range []string{
		"SELECT id FROM owners LIMIT 0",
		"SELECT owner_id,id,source_name,raw_text,parent_id,created_at,updated_at FROM resume_documents LIMIT 0",
	} {
		rows, err := s.reader.QueryContext(ctx, query)
		if err != nil {
			return fmt.Errorf("check business schema: %w", err)
		}
		if err = rows.Close(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) Close() error {
	var first error
	if s.reader != nil {
		first = s.reader.Close()
	}
	if s.writer != nil {
		if err := s.writer.Close(); first == nil {
			first = err
		}
	}
	return first
}

var ErrNotFound = errors.New("resume not found")
var ErrInvalidResume = errors.New("invalid resume")

type Resume struct {
	ID         string `json:"id"`
	SourceName string `json:"sourceName"`
	RawText    string `json:"rawText,omitempty"`
	CreatedAt  int64  `json:"createdAt"`
}

// Snapshots are immutable. Updates in the browser never overwrite a saved snapshot.
func (s *Store) CreateResume(ctx context.Context, owner, name, text string) (Resume, error) {
	if strings.TrimSpace(owner) == "" || strings.TrimSpace(name) == "" || utf8.RuneCountInString(name) > 512 || strings.TrimSpace(text) == "" || len(text) > 1024*1024 {
		return Resume{}, ErrInvalidResume
	}
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return Resume{}, err
	}
	document := Resume{ID: hex.EncodeToString(bytes[:]), SourceName: name, RawText: text, CreatedAt: time.Now().UnixMilli()}
	tx, err := s.writer.BeginTx(ctx, nil)
	if err != nil {
		return Resume{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "INSERT INTO owners(id) VALUES (?) ON CONFLICT DO NOTHING", owner); err != nil {
		return Resume{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO resume_documents(owner_id,id,source_name,raw_text,created_at,updated_at) VALUES (?,?,?,?,?,?)`, owner, document.ID, name, text, document.CreatedAt, document.CreatedAt); err != nil {
		return Resume{}, err
	}
	if err = tx.Commit(); err != nil {
		return Resume{}, err
	}
	return document, nil
}

func (s *Store) ListResumes(ctx context.Context, owner string) ([]Resume, error) {
	rows, err := s.reader.QueryContext(ctx, "SELECT id,source_name,created_at FROM resume_documents WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 100", owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	documents := []Resume{}
	for rows.Next() {
		var document Resume
		if err = rows.Scan(&document.ID, &document.SourceName, &document.CreatedAt); err != nil {
			return nil, err
		}
		documents = append(documents, document)
	}
	return documents, rows.Err()
}

func (s *Store) GetResume(ctx context.Context, owner, id string) (Resume, error) {
	var document Resume
	err := s.reader.QueryRowContext(ctx, "SELECT id,source_name,raw_text,created_at FROM resume_documents WHERE owner_id=? AND id=?", owner, id).Scan(&document.ID, &document.SourceName, &document.RawText, &document.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Resume{}, ErrNotFound
	}
	if err != nil {
		return Resume{}, fmt.Errorf("read resume: %w", err)
	}
	return document, nil
}
