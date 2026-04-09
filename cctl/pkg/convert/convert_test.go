package convert

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func loadTestData(t *testing.T, name string) (claude, expectedPi []byte) {
	t.Helper()
	dir := "testdata"

	claudePath := filepath.Join(dir, name+".claude.jsonl")
	claudeData, err := os.ReadFile(claudePath)
	if err != nil {
		t.Fatalf("reading %s: %v", claudePath, err)
	}

	piPath := filepath.Join(dir, name+".pi.jsonl")
	piData, err := os.ReadFile(piPath)
	if err != nil {
		t.Fatalf("reading %s: %v", piPath, err)
	}

	return claudeData, piData
}

// comparePiOutput does line-by-line JSON comparison, ignoring key order.
func comparePiOutput(t *testing.T, got, want []byte) {
	t.Helper()

	gotLines := splitJSONL(got)
	wantLines := splitJSONL(want)

	if len(gotLines) != len(wantLines) {
		t.Errorf("line count: got %d, want %d", len(gotLines), len(wantLines))
		t.Logf("GOT:\n%s", string(got))
		t.Logf("WANT:\n%s", string(want))
		return
	}

	for i := range gotLines {
		var gotObj, wantObj interface{}
		if err := json.Unmarshal(gotLines[i], &gotObj); err != nil {
			t.Errorf("line %d: invalid JSON in got: %v", i+1, err)
			continue
		}
		if err := json.Unmarshal(wantLines[i], &wantObj); err != nil {
			t.Errorf("line %d: invalid JSON in want: %v", i+1, err)
			continue
		}

		gotJSON, _ := json.Marshal(gotObj)
		wantJSON, _ := json.Marshal(wantObj)
		if string(gotJSON) != string(wantJSON) {
			t.Errorf("line %d mismatch:\n  got:  %s\n  want: %s", i+1, string(gotJSON), string(wantJSON))
		}
	}
}

func splitJSONL(data []byte) [][]byte {
	var lines [][]byte
	for _, line := range splitLines(data) {
		if len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			line := data[start:i]
			if len(line) > 0 {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

func TestStringContent(t *testing.T) {
	claude, expectedPi := loadTestData(t, "05_string_content")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestImageAndDocument(t *testing.T) {
	claude, expectedPi := loadTestData(t, "06_image_and_document")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestThinking(t *testing.T) {
	claude, expectedPi := loadTestData(t, "07_thinking_blocks")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestErrorToolResult(t *testing.T) {
	claude, expectedPi := loadTestData(t, "10_error_tool_result")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestToolResultListContent(t *testing.T) {
	claude, expectedPi := loadTestData(t, "12_tool_result_list_content")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestStreamingMerge(t *testing.T) {
	claude, expectedPi := loadTestData(t, "03_streaming_merge")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestMultiToolStreaming(t *testing.T) {
	claude, expectedPi := loadTestData(t, "11_multi_tool_streaming")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestToolUseCycle(t *testing.T) {
	claude, expectedPi := loadTestData(t, "02_tool_use_cycle")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestSimpleChat(t *testing.T) {
	claude, expectedPi := loadTestData(t, "01_simple_chat")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
