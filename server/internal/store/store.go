package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

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
