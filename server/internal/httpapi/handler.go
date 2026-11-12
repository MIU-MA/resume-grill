package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Readiness interface{ Check(context.Context) error }

func Handler(database Readiness) http.Handler {
	mux := http.NewServeMux()
	reply := func(w http.ResponseWriter, code int, status string) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": status})
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { reply(w, http.StatusOK, "ok") })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := database.Check(ctx); err != nil {
			reply(w, http.StatusServiceUnavailable, "unavailable")
			return
		}
		reply(w, http.StatusOK, "ready")
	})
	return mux
}
