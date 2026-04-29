package notes

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
)

type VideoMetadata struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	VideoID     string `json:"video_id"`
	Channel     string `json:"channel"`
	PublishedAt string `json:"published_at"`
	CapturedAt  string `json:"captured_at"`
	ChannelID   string `json:"channel_id"`
	ChannelURL  string `json:"channel_url"`
	UploaderID  string `json:"uploader_id"`
	UploaderURL string `json:"uploader_url"`
}

type ChannelRecord struct {
	DirName     string   `json:"dir_name"`
	DisplayName string   `json:"display_name,omitempty"`
	ChannelID   string   `json:"channel_id,omitempty"`
	ChannelURL  string   `json:"channel_url,omitempty"`
	UploaderID  string   `json:"uploader_id,omitempty"`
	UploaderURL string   `json:"uploader_url,omitempty"`
	Aliases     []string `json:"aliases,omitempty"`
}

type VideoRecord struct {
	ChannelKey string `json:"channel_key"`
	Path       string `json:"path"`
	Title      string `json:"title,omitempty"`
}

type Move struct {
	OldPath     string `json:"old_path"`
	NewPath     string `json:"new_path"`
	VideoID     string `json:"video_id"`
	ChannelKey  string `json:"channel_key"`
	ChannelDir  string `json:"channel_dir"`
	DisplayName string `json:"display_name,omitempty"`
}

type ReviewItem struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

type Plan struct {
	Channels map[string]ChannelRecord `json:"channels"`
	Videos   map[string]VideoRecord   `json:"videos"`
	Moves    []Move                   `json:"moves"`
	Review   []ReviewItem             `json:"review"`
}

type candidate struct {
	oldPath    string
	videoPath  string
	meta       VideoMetadata
	channelKey string
}

func PlanLibrary(root string) (*Plan, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read root: %w", err)
	}

	plan := &Plan{
		Channels: make(map[string]ChannelRecord),
		Videos:   make(map[string]VideoRecord),
	}

	var candidates []candidate
	channelDirByKey := map[string]string{}
	usedDirNames := map[string]string{}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if strings.HasPrefix(entry.Name(), ".") || entry.Name() == "channels" {
			continue
		}

		videoPath := filepath.Join(root, entry.Name())
		notesPath := filepath.Join(videoPath, "notes.md")
		if _, err := os.Stat(notesPath); err != nil {
			continue
		}

		meta, err := loadMetadata(videoPath)
		if err != nil {
			plan.Review = append(plan.Review, ReviewItem{Path: videoPath, Reason: err.Error()})
			continue
		}
		meta = withFallbacks(meta, entry.Name())

		if strings.TrimSpace(meta.VideoID) == "" {
			plan.Review = append(plan.Review, ReviewItem{Path: videoPath, Reason: "missing video_id"})
			continue
		}

		channelKey, ok := resolveChannelKey(meta)
		if !ok {
			plan.Review = append(plan.Review, ReviewItem{Path: videoPath, Reason: "missing channel identity"})
			continue
		}

		dirName, ok := channelDirByKey[channelKey]
		if !ok {
			base := slugify(firstNonEmpty(meta.Channel, meta.UploaderID, meta.ChannelID, channelKey))
			if base == "" {
				base = "unknown-channel"
			}
			dirName = uniqueDirName(base, channelKey, meta, usedDirNames)
			channelDirByKey[channelKey] = dirName
			usedDirNames[dirName] = channelKey
			plan.Channels[channelKey] = buildChannelRecord(dirName, meta)
		} else {
			record := mergeChannelRecord(plan.Channels[channelKey], meta)
			plan.Channels[channelKey] = record
		}

		candidates = append(candidates, candidate{
			oldPath:    entry.Name(),
			videoPath:  videoPath,
			meta:       meta,
			channelKey: channelKey,
		})
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].oldPath < candidates[j].oldPath
	})

	for _, item := range candidates {
		channelDir := channelDirByKey[item.channelKey]
		date := videoDate(item.meta, item.oldPath)
		year := "unknown"
		if len(date) >= 4 {
			year = date[:4]
		}
		videoSlug := slugify(titleOrDir(item.meta.Title, item.oldPath))
		newPath := filepath.ToSlash(filepath.Join("channels", channelDir, year, fmt.Sprintf("%s_%s--%s", date, videoSlug, item.meta.VideoID)))

		plan.Moves = append(plan.Moves, Move{
			OldPath:     item.oldPath,
			NewPath:     newPath,
			VideoID:     item.meta.VideoID,
			ChannelKey:  item.channelKey,
			ChannelDir:  channelDir,
			DisplayName: item.meta.Channel,
		})
		plan.Videos[item.meta.VideoID] = VideoRecord{
			ChannelKey: item.channelKey,
			Path:       newPath,
			Title:      item.meta.Title,
		}
	}

	return plan, nil
}

func WriteRegistries(root string) (*Plan, error) {
	plan, err := PlanLibrary(root)
	if err != nil {
		return nil, err
	}
	if err := writeRegistries(root, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

func ApplyLayout(root string) (*Plan, error) {
	plan, err := PlanLibrary(root)
	if err != nil {
		return nil, err
	}
	if err := validateMoves(root, plan.Moves); err != nil {
		return nil, err
	}
	for _, move := range plan.Moves {
		targetPath := filepath.Join(root, filepath.FromSlash(move.NewPath))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return nil, fmt.Errorf("create target dir for %s: %w", move.NewPath, err)
		}
	}
	for _, move := range plan.Moves {
		sourcePath := filepath.Join(root, move.OldPath)
		targetPath := filepath.Join(root, filepath.FromSlash(move.NewPath))
		if err := os.Rename(sourcePath, targetPath); err != nil {
			return nil, fmt.Errorf("move %s -> %s: %w", sourcePath, targetPath, err)
		}
	}
	if len(plan.Moves) > 0 {
		if err := writeRegistries(root, plan); err != nil {
			return nil, err
		}
	}
	return plan, nil
}

func writeRegistries(root string, plan *Plan) error {
	indexDir := filepath.Join(root, ".index")
	if err := os.MkdirAll(indexDir, 0o755); err != nil {
		return fmt.Errorf("create index dir: %w", err)
	}
	if err := writeJSONFile(filepath.Join(indexDir, "channels.json"), plan.Channels); err != nil {
		return fmt.Errorf("write channels registry: %w", err)
	}
	if err := writeJSONFile(filepath.Join(indexDir, "videos.json"), plan.Videos); err != nil {
		return fmt.Errorf("write videos registry: %w", err)
	}
	return nil
}

func validateMoves(root string, moves []Move) error {
	for _, move := range moves {
		sourcePath := filepath.Join(root, move.OldPath)
		sourceInfo, err := os.Stat(sourcePath)
		if err != nil {
			return fmt.Errorf("stat source %s: %w", sourcePath, err)
		}
		if !sourceInfo.IsDir() {
			return fmt.Errorf("source %s is not a directory", sourcePath)
		}

		targetPath := filepath.Join(root, filepath.FromSlash(move.NewPath))
		if _, err := os.Stat(targetPath); err == nil {
			return fmt.Errorf("target already exists: %s", targetPath)
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("stat target %s: %w", targetPath, err)
		}
	}
	return nil
}

func loadMetadata(videoPath string) (VideoMetadata, error) {
	meta, err := parseFrontmatter(filepath.Join(videoPath, "notes.md"))
	if err != nil {
		return VideoMetadata{}, fmt.Errorf("parse notes frontmatter: %w", err)
	}

	for _, filename := range []string{"video-metadata.json", "metadata.json"} {
		path := filepath.Join(videoPath, filename)
		if _, err := os.Stat(path); err == nil {
			if err := mergeJSONMetadata(path, &meta); err != nil {
				return VideoMetadata{}, fmt.Errorf("parse %s: %w", filename, err)
			}
		}
	}

	return meta, nil
}

func parseFrontmatter(path string) (VideoMetadata, error) {
	f, err := os.Open(path)
	if err != nil {
		return VideoMetadata{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	inFrontmatter := false
	seenFence := false
	meta := VideoMetadata{}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if !seenFence {
			if trimmed != "---" {
				return meta, nil
			}
			seenFence = true
			inFrontmatter = true
			continue
		}
		if inFrontmatter && trimmed == "---" {
			break
		}
		if !inFrontmatter || trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if strings.TrimLeft(line, " \t") != line {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		switch key {
		case "title":
			meta.Title = value
		case "url":
			meta.URL = value
		case "video_id":
			meta.VideoID = value
		case "channel":
			meta.Channel = value
		case "published_at", "date":
			if meta.PublishedAt == "" {
				meta.PublishedAt = value
			}
		case "captured_at":
			meta.CapturedAt = value
		case "channel_id":
			meta.ChannelID = value
		case "channel_url":
			meta.ChannelURL = value
		case "uploader_id":
			meta.UploaderID = value
		case "uploader_url":
			meta.UploaderURL = value
		}
	}
	if err := scanner.Err(); err != nil {
		return VideoMetadata{}, err
	}
	return meta, nil
}

func mergeJSONMetadata(path string, meta *VideoMetadata) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	mergeField(&meta.Title, raw, "title")
	mergeField(&meta.URL, raw, "url", "webpage_url", "original_url")
	mergeField(&meta.VideoID, raw, "video_id", "id")
	mergeField(&meta.Channel, raw, "channel", "uploader")
	mergeField(&meta.PublishedAt, raw, "published_at", "upload_date")
	mergeField(&meta.ChannelID, raw, "channel_id")
	mergeField(&meta.ChannelURL, raw, "channel_url")
	mergeField(&meta.UploaderID, raw, "uploader_id")
	mergeField(&meta.UploaderURL, raw, "uploader_url")
	return nil
}

func mergeField(dst *string, raw map[string]any, keys ...string) {
	if strings.TrimSpace(*dst) != "" {
		return
	}
	for _, key := range keys {
		value, ok := raw[key]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case string:
			*dst = strings.TrimSpace(v)
			if *dst != "" {
				return
			}
		}
	}
}

func withFallbacks(meta VideoMetadata, dirName string) VideoMetadata {
	meta.Title = strings.TrimSpace(meta.Title)
	meta.URL = strings.TrimSpace(meta.URL)
	meta.VideoID = strings.TrimSpace(meta.VideoID)
	meta.Channel = strings.TrimSpace(meta.Channel)
	meta.PublishedAt = normalizeDate(meta.PublishedAt)
	meta.CapturedAt = strings.TrimSpace(meta.CapturedAt)
	meta.ChannelID = strings.TrimSpace(meta.ChannelID)
	meta.ChannelURL = canonicalizeURL(meta.ChannelURL)
	meta.UploaderID = strings.TrimSpace(meta.UploaderID)
	meta.UploaderURL = canonicalizeURL(meta.UploaderURL)
	if meta.ChannelURL == "" && meta.UploaderURL != "" {
		meta.ChannelURL = meta.UploaderURL
	}
	if meta.Channel == "" && meta.UploaderID != "" {
		meta.Channel = meta.UploaderID
	}
	if meta.Title == "" {
		meta.Title = strings.TrimSpace(dirName)
	}
	return meta
}

func resolveChannelKey(meta VideoMetadata) (string, bool) {
	if meta.ChannelID != "" {
		return "yt:channel:" + meta.ChannelID, true
	}
	if handle := normalizeHandle(meta.UploaderID); handle != "" {
		return "yt:handle:" + strings.ToLower(handle), true
	}
	if url := canonicalizeURL(firstNonEmpty(meta.ChannelURL, meta.UploaderURL)); url != "" {
		return "yt:url:" + url, true
	}
	if name := slugify(meta.Channel); name != "" {
		return "yt:name:" + name, true
	}
	return "", false
}

func buildChannelRecord(dirName string, meta VideoMetadata) ChannelRecord {
	record := ChannelRecord{
		DirName:     dirName,
		DisplayName: meta.Channel,
		ChannelID:   meta.ChannelID,
		ChannelURL:  meta.ChannelURL,
		UploaderID:  meta.UploaderID,
		UploaderURL: meta.UploaderURL,
	}
	record = mergeChannelRecord(record, meta)
	return record
}

func mergeChannelRecord(record ChannelRecord, meta VideoMetadata) ChannelRecord {
	if record.DisplayName == "" {
		record.DisplayName = meta.Channel
	}
	if record.ChannelID == "" {
		record.ChannelID = meta.ChannelID
	}
	if record.ChannelURL == "" {
		record.ChannelURL = meta.ChannelURL
	}
	if record.UploaderID == "" {
		record.UploaderID = meta.UploaderID
	}
	if record.UploaderURL == "" {
		record.UploaderURL = meta.UploaderURL
	}
	aliasSet := map[string]struct{}{}
	for _, alias := range record.Aliases {
		if alias != "" {
			aliasSet[alias] = struct{}{}
		}
	}
	for _, alias := range []string{normalizeDisplayName(meta.Channel), strings.ToLower(normalizeHandle(meta.UploaderID))} {
		if alias == "" {
			continue
		}
		aliasSet[alias] = struct{}{}
	}
	record.Aliases = record.Aliases[:0]
	for alias := range aliasSet {
		record.Aliases = append(record.Aliases, alias)
	}
	sort.Strings(record.Aliases)
	return record
}

func uniqueDirName(base, channelKey string, meta VideoMetadata, used map[string]string) string {
	if owner, ok := used[base]; !ok || owner == channelKey {
		return base
	}
	suffix := collisionSuffix(channelKey, meta)
	candidate := base + "--" + suffix
	if owner, ok := used[candidate]; !ok || owner == channelKey {
		return candidate
	}
	for i := 2; ; i++ {
		candidate = fmt.Sprintf("%s--%s-%d", base, suffix, i)
		if owner, ok := used[candidate]; !ok || owner == channelKey {
			return candidate
		}
	}
}

func collisionSuffix(channelKey string, meta VideoMetadata) string {
	for _, value := range []string{meta.ChannelID, normalizeHandle(meta.UploaderID), canonicalizeURL(firstNonEmpty(meta.ChannelURL, meta.UploaderURL)), channelKey} {
		slug := slugify(value)
		if slug != "" {
			return slug
		}
	}
	return "dup"
}

func normalizeHandle(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.TrimPrefix(s, "https://www.youtube.com/")
	s = strings.TrimPrefix(s, "https://youtube.com/")
	s = strings.TrimPrefix(s, "@")
	s = strings.TrimSpace(strings.Trim(s, "/"))
	if s == "" {
		return ""
	}
	return "@" + s
}

func canonicalizeURL(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return ""
	}
	for _, sep := range []string{"?", "#"} {
		if idx := strings.Index(raw, sep); idx >= 0 {
			raw = raw[:idx]
		}
	}
	raw = strings.TrimSuffix(raw, "/")
	return raw
}

func normalizeDisplayName(s string) string {
	return slugify(s)
}

func slugify(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			prevDash = false
		case r == '@':
			continue
		default:
			if !prevDash {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	return out
}

func normalizeDate(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 10 && s[4] == '-' && s[7] == '-' {
		return s[:10]
	}
	if len(s) == 8 && strings.IndexByte(s, '-') == -1 {
		return s[:4] + "-" + s[4:6] + "-" + s[6:8]
	}
	return s
}

func videoDate(meta VideoMetadata, dirName string) string {
	if len(dirName) >= 10 && dirName[4] == '-' && dirName[7] == '-' {
		return dirName[:10]
	}
	for _, candidate := range []string{normalizeDate(meta.PublishedAt), normalizeDate(meta.CapturedAt)} {
		if len(candidate) >= 10 {
			return candidate[:10]
		}
	}
	return "unknown-date"
}

func titleOrDir(title, dirName string) string {
	if len(dirName) > 11 {
		return dirName[11:]
	}
	if strings.TrimSpace(title) != "" {
		return title
	}
	return dirName
}

func writeJSONFile(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o644)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
