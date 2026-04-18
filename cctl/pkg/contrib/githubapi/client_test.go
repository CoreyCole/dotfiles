package githubapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
)

func TestListDefaultBranchCommitsPagination(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch trimAPIPath(r.URL.Path) {
		case "/repos/o/r":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `{"default_branch":"main"}`)
		case "/repos/o/r/commits":
			if r.URL.Query().Get("page") == "2" {
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintln(w, `[{"sha":"c2","commit":{"committer":{"date":"2026-01-02T12:00:00Z"}},"html_url":"https://github.com/o/r/commit/c2"}]`)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Link", "<http://example.com/repos/o/r/commits?per_page=100&page=2>; rel=\"next\"")
			fmt.Fprintln(w, `[{"sha":"c1","commit":{"committer":{"date":"2026-01-01T12:00:00Z"}},"html_url":"https://github.com/o/r/commit/c1"}]`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	githubClient := httpClientWithURLs(t, server)
	service := &ClientImpl{gh: githubClient}

	commits, err := service.ListDefaultBranchCommits(context.Background(), "o", "r", parseDateUTCMust(t, "2026-01-01"), parseDateUTCMust(t, "2026-01-03"))
	if err != nil {
		t.Fatalf("ListDefaultBranchCommits: %v", err)
	}
	if len(commits) != 2 {
		t.Fatalf("got %d commits, want 2", len(commits))
	}
	if commits[0].SHA != "c1" || commits[1].SHA != "c2" {
		t.Fatalf("unexpected commits: %#v", commits)
	}
}

func TestListPRFilesPagination(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch trimAPIPath(r.URL.Path) {
		case "/repos/o/r":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `{"default_branch":"main"}`)
		case "/repos/o/r/pulls/123/files":
			if r.URL.Query().Get("page") == "2" {
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintln(w, `[{"filename":"x.proto","status":"added","additions":1,"deletions":0,"changes":1}]`)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Link", "<http://example.com/repos/o/r/pulls/123/files?per_page=100&page=2>; rel=\"next\"")
			fmt.Fprintln(w, `[{"filename":"x.go","status":"added","additions":2,"deletions":1,"changes":3}]`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	githubClient := httpClientWithURLs(t, server)
	service := &ClientImpl{gh: githubClient}

	files, err := service.ListPRFiles(context.Background(), "o", "r", 123)
	if err != nil {
		t.Fatalf("ListPRFiles: %v", err)
	}
	if len(files) != 2 {
		t.Fatalf("got %d files, want 2", len(files))
	}
	if files[1].Filename != "x.proto" {
		t.Fatalf("unexpected files: %#v", files)
	}
}

func TestGetAssociatedMergedPROnlyReturnsMergedPR(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch trimAPIPath(r.URL.Path) {
		case "/repos/o/r/commits/c1/pulls":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `[{"number": 10, "merged_at": "2026-01-01T12:00:00Z"}]`)
		case "/repos/o/r/pulls/10":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `{"number":10,"merged_at":"2026-01-01T12:00:00Z","title":"Merged PR","html_url":"https://github.com/o/r/pull/10","user":{"login":"alice"}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	githubClient := httpClientWithURLs(t, server)
	service := &ClientImpl{gh: githubClient}
	got, err := service.GetAssociatedMergedPR(context.Background(), "o", "r", "c1")
	if err != nil {
		t.Fatalf("GetAssociatedMergedPR: %v", err)
	}
	if got == nil || got.GetNumber() != 10 {
		t.Fatalf("got %#v, want PR number 10", got)
	}
}

func TestGetAssociatedMergedPRReturnsNilForDirectPush(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch trimAPIPath(r.URL.Path) {
		case "/repos/o/r/commits/c1/pulls":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `[{"number": 10, "merged_at": null}]`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	githubClient := httpClientWithURLs(t, server)
	service := &ClientImpl{gh: githubClient}
	got, err := service.GetAssociatedMergedPR(context.Background(), "o", "r", "c1")
	if err != nil {
		t.Fatalf("GetAssociatedMergedPR: %v", err)
	}
	if got != nil {
		t.Fatalf("got %#v, want nil", got)
	}
}

func TestGetCommitDetails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch trimAPIPath(r.URL.Path) {
		case "/repos/o/r/commits/c1":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `{
				"sha":"c1",
				"html_url":"https://github.com/o/r/commit/c1",
				"author":{"login":"alice","name":"Alice"},
				"commit": {"author": {"date":"2026-01-02T00:00:00Z"}},
				"stats": {"additions": 4, "deletions": 2, "total": 6, "files": 2},
				"files": [
					{"filename":"main.go","status":"added","additions":3,"deletions":1,"changes":4},
					{"filename":"readme.md","status":"modified","additions":1,"deletions":1,"changes":2}
				]
			}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	githubClient := httpClientWithURLs(t, server)
	service := &ClientImpl{gh: githubClient}

	details, err := service.GetCommitDetails(context.Background(), "o", "r", "c1")
	if err != nil {
		t.Fatalf("GetCommitDetails: %v", err)
	}
	if details.SHA != "c1" {
		t.Fatalf("got SHA %q", details.SHA)
	}
	if details.Username != "alice" {
		t.Fatalf("got username %q", details.Username)
	}
	if details.DisplayName != "Alice" {
		t.Fatalf("got display name %q", details.DisplayName)
	}
	if details.Additions != 4 || details.Deletions != 2 {
		t.Fatalf("got additions/deletions %d/%d", details.Additions, details.Deletions)
	}
	if details.ChangedFiles != 2 {
		t.Fatalf("got changed files %d", details.ChangedFiles)
	}
	if len(details.Files) != 2 {
		t.Fatalf("got %d files", len(details.Files))
	}
}

func httpClientWithURLs(t *testing.T, server *httptest.Server) *github.Client {
	t.Helper()
	client, err := githubClientWithEnterpriseURLs(server)
	if err != nil {
		t.Fatalf("with enterprise urls: %v", err)
	}
	return client
}

func githubClientWithEnterpriseURLs(server *httptest.Server) (*github.Client, error) {
	client := github.NewClient(nil)
	return client.WithEnterpriseURLs(server.URL+"/", server.URL+"/")
}

func parseDateUTCMust(t *testing.T, date string) time.Time {
	t.Helper()
	tm, err := time.ParseInLocation("2006-01-02", date, time.UTC)
	if err != nil {
		t.Fatalf("parse date %q: %v", date, err)
	}
	return tm
}

func trimAPIPath(path string) string {
	return strings.TrimPrefix(path, "/api/v3")
}
