package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/MIU-MA/resume-grill/server/internal/httpapi"
	"github.com/MIU-MA/resume-grill/server/internal/store"
)

func validateAddress(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || !ip.IsLoopback() {
		return fmt.Errorf("this prototype only accepts literal loopback addresses")
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return fmt.Errorf("invalid listening port")
	}
	return nil
}

func run(ctx context.Context, address, path, token, owner string) error {
	if err := validateAddress(address); err != nil {
		return err
	}
	if !httpapi.ValidAccessToken(token) || strings.TrimSpace(owner) == "" {
		return fmt.Errorf("WORKBENCH_TOKEN must contain at least 32 printable ASCII characters without whitespace; owner must not be empty")
	}
	startup, cancel := context.WithTimeout(ctx, 10*time.Second)
	database, err := store.Open(startup, path)
	cancel()
	if err != nil {
		return err
	}
	defer database.Close()
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}
	defer listener.Close()
	mux := http.NewServeMux()
	mux.Handle("/v1/", httpapi.ResumeHandler(database, token, owner))
	mux.Handle("/", httpapi.Handler(database))
	server := &http.Server{
		Addr: address, Handler: mux,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second,
	}
	log.Printf("workbench service ready at http://%s", listener.Addr())
	stopped := make(chan error, 1)
	go func() { stopped <- server.Serve(listener) }()
	select {
	case err = <-stopped:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if err = server.Shutdown(shutdown); err != nil {
			_ = server.Close()
			return err
		}
		return nil
	}
}

func main() {
	address := flag.String("listen", "127.0.0.1:3108", "loopback HTTP address")
	path := flag.String("db", "../.server/workbench.db", "SQLite database file")
	owner := flag.String("owner", "local", "local data namespace (not a user login)")
	flag.Parse()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := run(ctx, *address, *path, os.Getenv("WORKBENCH_TOKEN"), *owner); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}
