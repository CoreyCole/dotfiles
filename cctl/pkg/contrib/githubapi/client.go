package githubapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/go-github/v69/github"
	"golang.org/x/oauth2"
)

type BranchCommit struct {
	SHA         string
	CommittedAt time.Time
	URL         string
}

type PRSummary struct {
	Number            int
	Title             string
	URL               string
	Username          string
	DisplayName       string
	AuthorAssociation string
	MergedAt          time.Time
	CreatedAt         time.Time
	MergedBy          string
	BaseRef           string
	HeadRef           string
	MergeCommitSHA    string
	IsDraft           bool
	Labels            []string
	CommentCount      int
	ReviewCount       int
	CommitsCount      int
	Additions         int
	Deletions         int
	ChangedFiles      int
}

type CommitDetails struct {
	SHA          string
	CommittedAt  time.Time
	URL          string
	Username     string
	DisplayName  string
	Additions    int
	Deletions    int
	ChangedFiles int
	Files        []PRFile
}

type PRFile struct {
	Filename  string
	Status    string
	Additions int
	Deletions int
	Changes   int
}

type ExtensionStat struct {
	Added        int `json:"added"`
	Removed      int `json:"removed"`
	Changed      int `json:"changed"`
	FilesTouched int `json:"files_touched"`
}

type Client interface {
	ListDefaultBranchCommits(ctx context.Context, owner, repo string, since, until time.Time) ([]BranchCommit, error)
	GetAssociatedMergedPR(ctx context.Context, owner, repo, sha string) (*github.PullRequest, error)
	GetPRSummary(ctx context.Context, owner, repo string, number int) (*PRSummary, error)
	ListPRFiles(ctx context.Context, owner, repo string, number int) ([]PRFile, error)
	GetCommitDetails(ctx context.Context, owner, repo, sha string) (*CommitDetails, error)
}

type ClientImpl struct {
	gh *github.Client
}

func NewClient(token string) (*ClientImpl, error) {
	if token == "" {
		return nil, fmt.Errorf("missing GitHub token (--github-token or GITHUB_TOKEN)")
	}
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	hc := oauth2.NewClient(context.Background(), ts)
	return &ClientImpl{gh: github.NewClient(hc)}, nil
}

func (c *ClientImpl) ListDefaultBranchCommits(ctx context.Context, owner, repo string, since, until time.Time) ([]BranchCommit, error) {
	repoInfo, _, err := c.gh.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return nil, fmt.Errorf("get repo: %w", err)
	}
	branch := repoInfo.GetDefaultBranch()
	if branch == "" {
		return nil, fmt.Errorf("default branch not found")
	}

	opt := &github.CommitsListOptions{
		SHA:         branch,
		Since:       since,
		Until:       until,
		ListOptions: github.ListOptions{PerPage: 100, Page: 1},
	}
	out := []BranchCommit{}
	for {
		commits, resp, err := c.gh.Repositories.ListCommits(ctx, owner, repo, opt)
		if err != nil {
			return nil, fmt.Errorf("list commits: %w", err)
		}
		for _, cm := range commits {
			out = append(out, BranchCommit{SHA: cm.GetSHA(), CommittedAt: cm.Commit.GetCommitter().GetDate().UTC(), URL: cm.GetHTMLURL()})
		}
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}
	return out, nil
}

func (c *ClientImpl) GetAssociatedMergedPR(ctx context.Context, owner, repo, sha string) (*github.PullRequest, error) {
	prs, _, err := c.gh.PullRequests.ListPullRequestsWithCommit(ctx, owner, repo, sha, &github.ListOptions{PerPage: 50})
	if err != nil {
		return nil, fmt.Errorf("list pull requests with commit: %w", err)
	}
	for _, pr := range prs {
		if pr.GetMergedAt().IsZero() {
			continue
		}
		full, _, err := c.gh.PullRequests.Get(ctx, owner, repo, pr.GetNumber())
		if err != nil {
			return nil, fmt.Errorf("get pull request %d: %w", pr.GetNumber(), err)
		}
		if !full.GetMergedAt().IsZero() {
			return full, nil
		}
	}
	return nil, nil
}

func (c *ClientImpl) GetPRSummary(ctx context.Context, owner, repo string, number int) (*PRSummary, error) {
	pr, _, err := c.gh.PullRequests.Get(ctx, owner, repo, number)
	if err != nil {
		return nil, err
	}
	reviews, _, _ := c.gh.PullRequests.ListReviews(ctx, owner, repo, number, &github.ListOptions{PerPage: 100})
	labels := make([]string, 0, len(pr.Labels))
	for _, l := range pr.Labels {
		labels = append(labels, l.GetName())
	}
	return &PRSummary{
		Number:            pr.GetNumber(),
		Title:             pr.GetTitle(),
		URL:               pr.GetHTMLURL(),
		Username:          pr.User.GetLogin(),
		DisplayName:       pr.User.GetName(),
		AuthorAssociation: pr.GetAuthorAssociation(),
		MergedAt:          pr.GetMergedAt().UTC(),
		CreatedAt:         pr.GetCreatedAt().UTC(),
		MergedBy:          pr.MergedBy.GetLogin(),
		BaseRef:           pr.Base.GetRef(),
		HeadRef:           pr.Head.GetRef(),
		MergeCommitSHA:    pr.GetMergeCommitSHA(),
		IsDraft:           pr.GetDraft(),
		Labels:            labels,
		CommentCount:      pr.GetComments(),
		ReviewCount:       len(reviews),
		CommitsCount:      pr.GetCommits(),
		Additions:         pr.GetAdditions(),
		Deletions:         pr.GetDeletions(),
		ChangedFiles:      pr.GetChangedFiles(),
	}, nil
}

func (c *ClientImpl) ListPRFiles(ctx context.Context, owner, repo string, number int) ([]PRFile, error) {
	opt := &github.ListOptions{PerPage: 100, Page: 1}
	out := []PRFile{}
	for {
		files, resp, err := c.gh.PullRequests.ListFiles(ctx, owner, repo, number, opt)
		if err != nil {
			return nil, err
		}
		for _, f := range files {
			out = append(out, PRFile{
				Filename:  f.GetFilename(),
				Status:    f.GetStatus(),
				Additions: f.GetAdditions(),
				Deletions: f.GetDeletions(),
				Changes:   f.GetChanges(),
			})
		}
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}
	return out, nil
}

func (c *ClientImpl) GetCommitDetails(ctx context.Context, owner, repo, sha string) (*CommitDetails, error) {
	commit, _, err := c.gh.Repositories.GetCommit(ctx, owner, repo, sha, nil)
	if err != nil {
		return nil, fmt.Errorf("get commit %s: %w", sha, err)
	}

	files := make([]PRFile, 0, len(commit.Files))
	for _, f := range commit.Files {
		files = append(files, PRFile{
			Filename:  f.GetFilename(),
			Status:    f.GetStatus(),
			Additions: f.GetAdditions(),
			Deletions: f.GetDeletions(),
			Changes:   f.GetChanges(),
		})
	}

	username := ""
	if commit.Author != nil {
		username = commit.Author.GetLogin()
	}
	displayName := ""
	if commit.Author != nil {
		displayName = commit.Author.GetName()
	}
	if commit.Commit != nil && commit.Commit.Author != nil && displayName == "" {
		displayName = commit.Commit.Author.GetName()
	}

	additions := 0
	deletions := 0
	changedFiles := len(files)
	if commit.Stats != nil {
		additions = commit.Stats.GetAdditions()
		deletions = commit.Stats.GetDeletions()
	}

	committedAt := time.Time{}
	if commit.Commit != nil && commit.Commit.Author != nil {
		committedAt = commit.Commit.Author.GetDate().UTC()
	}

	if committedAt.IsZero() && commit.Committer != nil {
		committedAt = commit.Committer.GetCreatedAt().UTC()
	}

	return &CommitDetails{
		SHA:          commit.GetSHA(),
		CommittedAt:  committedAt,
		URL:          commit.GetHTMLURL(),
		Username:     username,
		DisplayName:  displayName,
		Additions:    additions,
		Deletions:    deletions,
		ChangedFiles: changedFiles,
		Files:        files,
	}, nil
}

var _ Client = (*ClientImpl)(nil)
