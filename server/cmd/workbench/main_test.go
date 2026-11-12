package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestInvalidCredentialsFailBeforeCreatingDatabase(t *testing.T) {
	for _, credentials := range [][2]string{{"", "local"}, {"short", "local"}, {"a-token-that-is-at-least-thirty-two-characters", " "}, {"a-token-that-is-at-least-thirty-two-characters ", "local"}, {"a-token-that-is-at-least-thirty-two-characters\n", "local"}, {"中文中文中文中文中文中文中文中文中文中文中文中文中文中文中文中文", "local"}} {
		path := filepath.Join(t.TempDir(), "not-created.db")
		if err := run(context.Background(), "127.0.0.1:3108", path, credentials[0], credentials[1]); err == nil {
			t.Fatal("accepted invalid credentials")
		}
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatal("invalid configuration created a database")
		}
	}
}

func TestOnlyLoopbackAddressesAllowed(t *testing.T) {
	for _, address := range []string{"127.0.0.1:3108", "[::1]:3108"} {
		if err := validateAddress(address); err != nil {
			t.Errorf("%s: %v", address, err)
		}
	}
	for _, address := range []string{":3108", "0.0.0.0:3108", "[::]:3108", "192.168.1.5:3108", "localhost:3108", "127.0.0.1:0", "127.0.0.1:65536", "127.0.0.1:http", "invalid"} {
		if err := validateAddress(address); err == nil {
			t.Errorf("accepted %s", address)
		}
	}
}
