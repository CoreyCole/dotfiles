package notes

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestResolveChannelIdentityPrefersStableMetadata(t *testing.T) {
	tests := []struct {
		name string
		meta VideoMetadata
		want string
	}{
		{
			name: "channel id wins",
			meta: VideoMetadata{ChannelID: "UC123", UploaderID: "@Example", Channel: "Example Channel"},
			want: "yt:channel:UC123",
		},
		{
			name: "handle used when channel id missing",
			meta: VideoMetadata{UploaderID: "ExampleHandle", Channel: "Example Channel"},
			want: "yt:handle:@examplehandle",
		},
		{
			name: "url used when ids missing",
			meta: VideoMetadata{ChannelURL: "https://www.youtube.com/@ExampleHandle?si=abc", Channel: "Example Channel"},
			want: "yt:url:https://www.youtube.com/@examplehandle",
		},
		{
			name: "normalized display name fallback",
			meta: VideoMetadata{Channel: "  The   Pragmatic_Engineer "},
			want: "yt:name:the-pragmatic-engineer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := resolveChannelKey(tt.meta)
			if !ok {
				t.Fatalf("resolveChannelKey(%+v) returned !ok", tt.meta)
			}
			if got != tt.want {
				t.Fatalf("resolveChannelKey(%+v) = %q, want %q", tt.meta, got, tt.want)
			}
		})
	}
}

func TestPlanLibraryBuildsRegistriesAndMarksManualReview(t *testing.T) {
	root := t.TempDir()

	mustWriteFile(t, filepath.Join(root, "2026-04-17_building-pi-in-a-world-of-slop-mario-zechner", "notes.md"), `---
title: "Building pi in a World of Slop — Mario Zechner"
url: https://youtu.be/RjfbvDXpFls?si=7WJ6U9JXlXepekZ7
video_id: RjfbvDXpFls
channel: AI Engineer
published_at: 2026-04-16
captured_at: 2026-04-17T18:55:49-07:00
source_type: youtube
status: captured
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-17_building-pi-in-a-world-of-slop-mario-zechner", "video-metadata.json"), map[string]any{
		"channel_id":   "UCabc123",
		"channel_url":  "https://www.youtube.com/channel/UCabc123",
		"uploader_id":  "@AIEngineer",
		"uploader_url": "https://www.youtube.com/@AIEngineer",
	})

	mustWriteFile(t, filepath.Join(root, "2026-04-18_state-of-agentic-coding", "notes.md"), `---
title: "State of Agentic Coding #5"
url: https://www.youtube.com/watch?v=state1234567
video_id: state1234567
channel: AI Engineer
published_at: 2026-04-18
captured_at: 2026-04-18T12:00:00-07:00
source_type: youtube
status: captured
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-18_state-of-agentic-coding", "video-metadata.json"), map[string]any{
		"channel_id":  "UCabc123",
		"uploader_id": "@AIEngineer",
	})

	mustWriteFile(t, filepath.Join(root, "2026-03-28_crispy-coding-agents-dex-horthy", "notes.md"), `---
title: "From RPI to QRSPI — Dex Horthy"
url: https://youtu.be/YwZR6tc7qYg
channel: The AI-Driven Dev Conference
---
`)

	plan, err := PlanLibrary(root)
	if err != nil {
		t.Fatalf("PlanLibrary() error = %v", err)
	}

	if len(plan.Moves) != 2 {
		t.Fatalf("len(plan.Moves) = %d, want 2", len(plan.Moves))
	}

	wantPaths := []string{
		"channels/ai-engineer/2026/2026-04-17_building-pi-in-a-world-of-slop-mario-zechner--RjfbvDXpFls",
		"channels/ai-engineer/2026/2026-04-18_state-of-agentic-coding--state1234567",
	}
	gotPaths := []string{plan.Moves[0].NewPath, plan.Moves[1].NewPath}
	if !reflect.DeepEqual(gotPaths, wantPaths) {
		t.Fatalf("move paths = %#v, want %#v", gotPaths, wantPaths)
	}

	channel, ok := plan.Channels["yt:channel:UCabc123"]
	if !ok {
		t.Fatalf("missing canonical channel registry entry")
	}
	if channel.DirName != "ai-engineer" {
		t.Fatalf("channel.DirName = %q, want ai-engineer", channel.DirName)
	}
	if channel.UploaderID != "@AIEngineer" {
		t.Fatalf("channel.UploaderID = %q, want @AIEngineer", channel.UploaderID)
	}

	video, ok := plan.Videos["RjfbvDXpFls"]
	if !ok {
		t.Fatalf("missing video registry entry")
	}
	if video.ChannelKey != "yt:channel:UCabc123" {
		t.Fatalf("video.ChannelKey = %q, want yt:channel:UCabc123", video.ChannelKey)
	}

	if len(plan.Review) != 1 {
		t.Fatalf("len(plan.Review) = %d, want 1", len(plan.Review))
	}
	if plan.Review[0].Reason != "missing video_id" {
		t.Fatalf("review reason = %q, want missing video_id", plan.Review[0].Reason)
	}
}

func TestWriteRegistriesPersistsIndexFiles(t *testing.T) {
	root := t.TempDir()

	mustWriteFile(t, filepath.Join(root, "2026-04-17_building-pi-in-a-world-of-slop-mario-zechner", "notes.md"), `---
title: "Building pi in a World of Slop — Mario Zechner"
url: https://youtu.be/RjfbvDXpFls?si=7WJ6U9JXlXepekZ7
video_id: RjfbvDXpFls
channel: AI Engineer
published_at: 2026-04-16
captured_at: 2026-04-17T18:55:49-07:00
source_type: youtube
status: captured
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-17_building-pi-in-a-world-of-slop-mario-zechner", "video-metadata.json"), map[string]any{
		"channel_id":   "UCabc123",
		"channel_url":  "https://www.youtube.com/channel/UCabc123",
		"uploader_id":  "@AIEngineer",
		"uploader_url": "https://www.youtube.com/@AIEngineer",
	})

	mustWriteFile(t, filepath.Join(root, "2026-04-18_state-of-agentic-coding", "notes.md"), `---
title: "State of Agentic Coding #5"
url: https://www.youtube.com/watch?v=state1234567
video_id: state1234567
channel: AI Engineer
published_at: 2026-04-18
captured_at: 2026-04-18T12:00:00-07:00
source_type: youtube
status: captured
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-18_state-of-agentic-coding", "video-metadata.json"), map[string]any{
		"channel_id":  "UCabc123",
		"uploader_id": "@AIEngineer",
	})

	mustWriteFile(t, filepath.Join(root, "2026-03-28_crispy-coding-agents-dex-horthy", "notes.md"), `---
title: "From RPI to QRSPI — Dex Horthy"
url: https://youtu.be/YwZR6tc7qYg
channel: The AI-Driven Dev Conference
---
`)

	plan, err := WriteRegistries(root)
	if err != nil {
		t.Fatalf("WriteRegistries() error = %v", err)
	}
	if len(plan.Review) != 1 {
		t.Fatalf("len(plan.Review) = %d, want 1", len(plan.Review))
	}

	channelsPath := filepath.Join(root, ".index", "channels.json")
	videosPath := filepath.Join(root, ".index", "videos.json")

	channelsData, err := os.ReadFile(channelsPath)
	if err != nil {
		t.Fatalf("ReadFile(%q): %v", channelsPath, err)
	}
	videosData, err := os.ReadFile(videosPath)
	if err != nil {
		t.Fatalf("ReadFile(%q): %v", videosPath, err)
	}

	var gotChannels map[string]ChannelRecord
	if err := json.Unmarshal(channelsData, &gotChannels); err != nil {
		t.Fatalf("Unmarshal channels.json: %v", err)
	}
	var gotVideos map[string]VideoRecord
	if err := json.Unmarshal(videosData, &gotVideos); err != nil {
		t.Fatalf("Unmarshal videos.json: %v", err)
	}

	wantChannels := map[string]ChannelRecord{
		"yt:channel:UCabc123": {
			DirName:     "ai-engineer",
			DisplayName: "AI Engineer",
			ChannelID:   "UCabc123",
			ChannelURL:  "https://www.youtube.com/channel/ucabc123",
			UploaderID:  "@AIEngineer",
			UploaderURL: "https://www.youtube.com/@aiengineer",
			Aliases:     []string{"@aiengineer", "ai-engineer"},
		},
	}
	if !reflect.DeepEqual(gotChannels, wantChannels) {
		t.Fatalf("channels.json = %#v, want %#v", gotChannels, wantChannels)
	}

	wantVideos := map[string]VideoRecord{
		"RjfbvDXpFls": {
			ChannelKey: "yt:channel:UCabc123",
			Path:       "channels/ai-engineer/2026/2026-04-17_building-pi-in-a-world-of-slop-mario-zechner--RjfbvDXpFls",
			Title:      "Building pi in a World of Slop — Mario Zechner",
		},
		"state1234567": {
			ChannelKey: "yt:channel:UCabc123",
			Path:       "channels/ai-engineer/2026/2026-04-18_state-of-agentic-coding--state1234567",
			Title:      "State of Agentic Coding #5",
		},
	}
	if !reflect.DeepEqual(gotVideos, wantVideos) {
		t.Fatalf("videos.json = %#v, want %#v", gotVideos, wantVideos)
	}

	if _, err := WriteRegistries(root); err != nil {
		t.Fatalf("second WriteRegistries() error = %v", err)
	}
	channelsData2, err := os.ReadFile(channelsPath)
	if err != nil {
		t.Fatalf("ReadFile(%q) after second write: %v", channelsPath, err)
	}
	videosData2, err := os.ReadFile(videosPath)
	if err != nil {
		t.Fatalf("ReadFile(%q) after second write: %v", videosPath, err)
	}
	if string(channelsData2) != string(channelsData) {
		t.Fatalf("channels.json changed between writes")
	}
	if string(videosData2) != string(videosData) {
		t.Fatalf("videos.json changed between writes")
	}
}

func TestDirNameCollisionProducesDeterministicSuffix(t *testing.T) {
	root := t.TempDir()

	mustWriteFile(t, filepath.Join(root, "2026-04-01_first", "notes.md"), `---
title: "First"
url: https://www.youtube.com/watch?v=video1111111
video_id: video1111111
channel: Same Name
published_at: 2026-04-01
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-01_first", "video-metadata.json"), map[string]any{"channel_id": "UC111111"})

	mustWriteFile(t, filepath.Join(root, "2026-04-02_second", "notes.md"), `---
title: "Second"
url: https://www.youtube.com/watch?v=video2222222
video_id: video2222222
channel: Same Name
published_at: 2026-04-02
---
`)
	mustWriteJSON(t, filepath.Join(root, "2026-04-02_second", "video-metadata.json"), map[string]any{"channel_id": "UC222222"})

	plan, err := PlanLibrary(root)
	if err != nil {
		t.Fatalf("PlanLibrary() error = %v", err)
	}

	first := plan.Channels["yt:channel:UC111111"]
	second := plan.Channels["yt:channel:UC222222"]
	if first.DirName != "same-name" {
		t.Fatalf("first dir = %q, want same-name", first.DirName)
	}
	if second.DirName != "same-name--uc222222" {
		t.Fatalf("second dir = %q, want same-name--uc222222", second.DirName)
	}
}

func mustWriteFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll(%q): %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile(%q): %v", path, err)
	}
}

func mustWriteJSON(t *testing.T, path string, value any) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("Marshal JSON: %v", err)
	}
	mustWriteFile(t, path, string(data))
}
