package session

import (
	"testing"
	"time"
)

func TestEncodePiPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/Users/coreycole/dotfiles", "--Users-coreycole-dotfiles--"},
	}
	for _, tt := range tests {
		got := encodePiPath(tt.input)
		if got != tt.want {
			t.Errorf("encodePiPath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDecodePiPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"--Users-coreycole-dotfiles--", "/Users/coreycole/dotfiles"},
	}
	for _, tt := range tests {
		got := decodePiPath(tt.input)
		if got != tt.want {
			t.Errorf("decodePiPath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestEncodeClaudePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/Users/coreycole/dotfiles", "-Users-coreycole-dotfiles"},
	}
	for _, tt := range tests {
		got := encodeClaudePath(tt.input)
		if got != tt.want {
			t.Errorf("encodeClaudePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDecodeClaudePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"-Users-coreycole-dotfiles", "/Users/coreycole/dotfiles"},
	}
	for _, tt := range tests {
		got := decodeClaudePath(tt.input)
		if got != tt.want {
			t.Errorf("decodeClaudePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestPiTimestamp(t *testing.T) {
	ts, err := piTimestamp("2026-04-09T17-13-10-661Z_539db649-ea6e-462f-b249-8ea6a57b9b97.jsonl")
	if err != nil {
		t.Fatalf("piTimestamp: %v", err)
	}
	expected := time.Date(2026, 4, 9, 17, 13, 10, 661000000, time.UTC)
	if !ts.Equal(expected) {
		t.Errorf("piTimestamp = %v, want %v", ts, expected)
	}
}
