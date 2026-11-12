package httpapi

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

type checkFunc func(context.Context) error

func (f checkFunc) Check(ctx context.Context) error { return f(ctx) }

func TestHealthAndReadiness(t *testing.T) {
	for _, tc := range []struct {
		name, method, path string
		failure            error
		code               int
		status             string
	}{
		{"alive without database", "GET", "/healthz", errors.New("private database path"), 200, "ok"},
		{"ready", "GET", "/readyz", nil, 200, "ready"},
		{"unavailable", "GET", "/readyz", errors.New("private database path"), 503, "unavailable"},
		{"unknown", "GET", "/missing", nil, 404, ""},
		{"method", "POST", "/readyz", nil, 405, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := Handler(checkFunc(func(ctx context.Context) error {
				called = true
				if _, ok := ctx.Deadline(); !ok {
					t.Fatal("readiness has no deadline")
				}
				return tc.failure
			}))
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(tc.method, tc.path, nil))
			if response.Code != tc.code {
				t.Fatalf("code %d; want %d", response.Code, tc.code)
			}
			if tc.status != "" {
				if got := strings.TrimSpace(response.Body.String()); got != `{"status":"`+tc.status+`"}` {
					t.Fatal(got)
				}
				if response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("health response may be cached")
				}
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("leaked internal error")
			}
			if called != (tc.method == "GET" && tc.path == "/readyz") {
				t.Fatal("unexpected database check")
			}
		})
	}
}
