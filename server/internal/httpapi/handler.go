package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/MIU-MA/resume-grill/server/internal/store"
)

type Readiness interface{ Check(context.Context) error }

func Handler(database Readiness) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		jsonReply(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := database.Check(ctx); err != nil {
			jsonReply(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			return
		}
		jsonReply(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	return mux
}

type ResumeRepository interface {
	CreateResume(context.Context, string, string, string) (store.Resume, error)
	ListResumes(context.Context, string) ([]store.Resume, error)
	GetResume(context.Context, string, string) (store.Resume, error)
}

// HTTP bearer tokens must survive header encoding without trimming or normalization.
func ValidAccessToken(token string) bool {
	if len(token) < 32 {
		return false
	}
	for _, character := range []byte(token) {
		if character < 0x21 || character > 0x7e {
			return false
		}
	}
	return true
}

// The owner is trusted service configuration, never a request parameter.
func ResumeHandler(repository ResumeRepository, token, owner string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/resumes", func(w http.ResponseWriter, r *http.Request) {
		documents, err := repository.ListResumes(r.Context(), owner)
		if err != nil {
			jsonReply(w, 503, map[string]string{"error": "database unavailable"})
			return
		}
		jsonReply(w, 200, documents)
	})
	mux.HandleFunc("GET /v1/resumes/{id}", func(w http.ResponseWriter, r *http.Request) {
		document, err := repository.GetResume(r.Context(), owner, r.PathValue("id"))
		if errors.Is(err, store.ErrNotFound) {
			jsonReply(w, 404, map[string]string{"error": "not found"})
			return
		}
		if err != nil {
			jsonReply(w, 503, map[string]string{"error": "database unavailable"})
			return
		}
		jsonReply(w, 200, document)
	})
	mux.HandleFunc("POST /v1/resumes", func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			jsonReply(w, 415, map[string]string{"error": "expected application/json"})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 2*1024*1024)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var input struct {
			SourceName string `json:"sourceName"`
			RawText    string `json:"rawText"`
		}
		if err := decoder.Decode(&input); err != nil {
			invalidBody(w, err)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			invalidBody(w, err)
			return
		}
		document, err := repository.CreateResume(r.Context(), owner, input.SourceName, input.RawText)
		if errors.Is(err, store.ErrInvalidResume) {
			jsonReply(w, 400, map[string]string{"error": "invalid resume"})
			return
		}
		if err != nil {
			jsonReply(w, 503, map[string]string{"error": "database unavailable"})
			return
		}
		jsonReply(w, 201, document)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !ValidAccessToken(token) || strings.TrimSpace(owner) == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+token)) != 1 {
			jsonReply(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		// Browsers use the same-origin Next.js bridge. Direct cross-origin access is unnecessary.
		if r.Header.Get("Origin") != "" {
			jsonReply(w, 403, map[string]string{"error": "use the workbench bridge"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}

func invalidBody(w http.ResponseWriter, err error) {
	code := 400
	var large *http.MaxBytesError
	if errors.As(err, &large) {
		code = 413
	}
	jsonReply(w, code, map[string]string{"error": "invalid request body"})
}

func jsonReply(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(value)
}
