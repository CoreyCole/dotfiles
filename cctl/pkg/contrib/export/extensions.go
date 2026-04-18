package export

import (
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"github.com/coreycole/cctl/pkg/contrib/githubapi"
)

func AccumulateByExtension(files []githubapi.PRFile) map[string]githubapi.ExtensionStat {
	stats := map[string]githubapi.ExtensionStat{}
	for _, f := range files {
		ext := extensionForFile(f.Filename)
		cur := stats[ext]
		cur.Added += f.Additions
		cur.Removed += f.Deletions
		cur.Changed += f.Changes
		cur.FilesTouched++
		stats[ext] = cur
	}
	return stats
}

func extensionForFile(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == "" {
		return "_no_ext"
	}
	return ext
}

func ApplyKnownExtensionColumns(row *Row, stats map[string]githubapi.ExtensionStat) {
	if s, ok := stats[".go"]; ok {
		row.GoLinesAdded, row.GoLinesRemoved, row.GoFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".proto"]; ok {
		row.ProtoLinesAdded, row.ProtoLinesRemoved, row.ProtoFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".sql"]; ok {
		row.SQLLinesAdded, row.SQLLinesRemoved, row.SQLFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".md"]; ok {
		row.MDLinesAdded, row.MDLinesRemoved, row.MDFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".ts"]; ok {
		row.TSLinesAdded, row.TSLinesRemoved, row.TSFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".tsx"]; ok {
		row.TSXLinesAdded, row.TSXLinesRemoved, row.TSXFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
}

func EncodeOtherExtensionStats(stats map[string]githubapi.ExtensionStat, known []string) (string, error) {
	knownSet := map[string]struct{}{}
	for _, k := range known {
		knownSet[strings.ToLower(k)] = struct{}{}
	}
	keys := make([]string, 0, len(stats))
	for k := range stats {
		if _, ok := knownSet[strings.ToLower(k)]; ok {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	ordered := map[string]githubapi.ExtensionStat{}
	for _, k := range keys {
		ordered[k] = stats[k]
	}
	b, err := json.Marshal(ordered)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
