package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

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
