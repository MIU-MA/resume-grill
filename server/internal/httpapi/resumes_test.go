package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/MIU-MA/resume-grill/server/internal/store"
)

const testToken = "test-token-at-least-thirty-two-characters"

func snapshotRequest(handler http.Handler, method, path, body, token, origin string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json; charset=utf-8")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func TestAuthenticatedSnapshotRoundTrip(t *testing.T) {
	db, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "resumes.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	alice := ResumeHandler(db, testToken, "alice")
	body := `{"sourceName":"简历.pdf","rawText":"个人概况\n项目内容"}`
	created := snapshotRequest(alice, "POST", "/v1/resumes", body, testToken, "")
	if created.Code != 201 {
		t.Fatalf("create %d %s", created.Code, created.Body)
	}
	var snapshot store.Resume
	if err = json.Unmarshal(created.Body.Bytes(), &snapshot); err != nil {
		t.Fatal(err)
	}
	loaded := snapshotRequest(alice, "GET", "/v1/resumes/"+snapshot.ID, "", testToken, "")
	if loaded.Code != 200 || loaded.Body.String() != created.Body.String() {
		t.Fatal("round trip changed snapshot")
	}
	bob := ResumeHandler(db, testToken, "bob")
	if result := snapshotRequest(bob, "GET", "/v1/resumes/"+snapshot.ID, "", testToken, ""); result.Code != 404 {
		t.Fatal("cross-owner read succeeded")
	}
	if result := snapshotRequest(bob, "GET", "/v1/resumes", "", testToken, ""); result.Body.String() != "[]\n" {
		t.Fatal("cross-owner listing leaked data")
	}
	for _, tc := range []struct {
		name, method, body, token, origin string
		code                              int
	}{
		{"no token", "GET", "", "", "", 401},
		{"bad token", "GET", "", "wrong", "", 401},
		{"browser origin", "GET", "", testToken, "https://other.example", 403},
		{"owner injection", "POST", `{"sourceName":"x","rawText":"x","owner":"bob"}`, testToken, "", 400},
		{"empty text", "POST", `{"sourceName":"x","rawText":" "}`, testToken, "", 400},
		{"two JSON bodies", "POST", body + body, testToken, "", 400},
		{"too large", "POST", `{"sourceName":"x","rawText":"` + strings.Repeat("x", 2*1024*1024) + `"}`, testToken, "", 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := snapshotRequest(alice, tc.method, "/v1/resumes", tc.body, tc.token, tc.origin)
			if result.Code != tc.code {
				t.Fatalf("status %d; want %d", result.Code, tc.code)
			}
			if result.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("response can be cached")
			}
		})
	}
	_ = db.Close()
	if result := snapshotRequest(alice, "GET", "/v1/resumes", "", testToken, ""); result.Code != 503 {
		t.Fatal("database failure reported as success")
	}
}
