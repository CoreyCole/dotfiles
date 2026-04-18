package export

import (
	"encoding/csv"
	"io"
	"strconv"
	"strings"
)

func WriteCSV(w io.Writer, rows []Row) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(Header()); err != nil {
		return err
	}
	for _, row := range rows {
		if err := cw.Write(Record(row)); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func Header() []string {
	return []string{
		"repo", "merged_at", "pr_created_at", "cycle_time_hours", "commit_sha", "commit_url",
		"github_username", "github_name", "pr_number", "pr_title", "pr_url", "lines_added", "lines_removed", "files_touched",
		"labels", "author_association", "merged_by", "review_count", "comment_count", "base_branch", "head_branch", "is_draft",
		"go_lines_added", "go_lines_removed", "go_files_touched",
		"proto_lines_added", "proto_lines_removed", "proto_files_touched",
		"sql_lines_added", "sql_lines_removed", "sql_files_touched",
		"md_lines_added", "md_lines_removed", "md_files_touched",
		"ts_lines_added", "ts_lines_removed", "ts_files_touched",
		"tsx_lines_added", "tsx_lines_removed", "tsx_files_touched",
		"other_lines_by_extension_json",
	}
}

func Record(row Row) []string {
	return []string{
		row.Repo,
		row.MergedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		row.PRCreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		strconv.FormatFloat(row.CycleTimeHours, 'f', 2, 64),
		row.CommitSHA,
		row.CommitURL,
		row.GitHubUsername,
		row.GitHubName,
		strconv.Itoa(row.PRNumber),
		row.PRTitle,
		row.PRURL,
		strconv.Itoa(row.LinesAdded),
		strconv.Itoa(row.LinesRemoved),
		strconv.Itoa(row.FilesTouched),
		strings.Join(row.Labels, ";"),
		row.AuthorAssociation,
		row.MergedBy,
		strconv.Itoa(row.ReviewCount),
		strconv.Itoa(row.CommentCount),
		row.BaseBranch,
		row.HeadBranch,
		strconv.FormatBool(row.IsDraft),
		strconv.Itoa(row.GoLinesAdded), strconv.Itoa(row.GoLinesRemoved), strconv.Itoa(row.GoFilesTouched),
		strconv.Itoa(row.ProtoLinesAdded), strconv.Itoa(row.ProtoLinesRemoved), strconv.Itoa(row.ProtoFilesTouched),
		strconv.Itoa(row.SQLLinesAdded), strconv.Itoa(row.SQLLinesRemoved), strconv.Itoa(row.SQLFilesTouched),
		strconv.Itoa(row.MDLinesAdded), strconv.Itoa(row.MDLinesRemoved), strconv.Itoa(row.MDFilesTouched),
		strconv.Itoa(row.TSLinesAdded), strconv.Itoa(row.TSLinesRemoved), strconv.Itoa(row.TSFilesTouched),
		strconv.Itoa(row.TSXLinesAdded), strconv.Itoa(row.TSXLinesRemoved), strconv.Itoa(row.TSXFilesTouched),
		row.OtherLinesByExtensionJSON,
	}
}
