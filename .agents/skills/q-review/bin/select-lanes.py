#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Deterministically select q-review focused lanes.

The selector is intentionally dependency-free and conservative. It routes from:
- outline mode: design.md, design-product.md, outline.md, and optional plan.md only
- implementation mode: explicit changed files, implement handoff paths, and git diff/status

It does not read questions/, research/, or context/ for lane selection.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
AGENTS_DIR = SKILL_DIR / "agents"

LANE_ORDER = [
    "q-review-intent-fit",
    "q-review-correctness",
    "q-review-project-guidance",
    "q-review-docs-health",
    "q-review-security-invariants",
    "q-review-tests-verification",
    "q-review-integration-ops",
    "q-review-maintainability",
    "q-review-go",
    "q-review-go-tests",
    "q-review-temporal",
    "q-review-sql",
    "q-review-snowflake",
    "q-review-react-ui",
    "q-review-datastar-ui",
    "q-review-data-tables",
    "q-review-identity-fields",
    "q-review-data-ingestion-quality",
    "q-review-ci-workflows",
    "q-review-api-auth",
    "q-review-error-visibility",
    "q-review-codebase-rules",
    "q-review-local-best-practices",
]

TEXT_FILE_EXTENSIONS = {
    ".go",
    ".sql",
    ".tsx",
    ".ts",
    ".jsx",
    ".js",
    ".templ",
    ".yaml",
    ".yml",
    ".json",
    ".md",
    ".mdx",
    ".proto",
    ".graphql",
    ".gql",
    ".sh",
    ".nix",
    ".toml",
    ".csv",
    ".tsv",
    ".mod",
    ".sum",
}

GENERATED_PATH_PATTERNS = (
    re.compile(r"(^|/)frontend/packages/proto/"),
    re.compile(r"(^|/)pkg/proto/"),
    re.compile(r"(^|/)pkg/db/.*\.go$"),
    re.compile(r"\.pb\.go$"),
    re.compile(r"\.connect\.go$"),
    re.compile(r"_pb\.ts$"),
    re.compile(r"_connect(query)?\.ts$"),
    re.compile(r"(^|/).*(generated|\.gen)\.(go|ts|tsx|js)$"),
)

KNOWN_PATH_PREFIXES = (
    ".agents/",
    ".claude/",
    ".cursor/",
    ".github/",
    ".pi-config/",
    "agent/",
    "api/",
    "cctl/",
    "cmd/",
    "cn-agents/",
    "context/",
    "db/",
    "docs/",
    "frontend/",
    "gateway/",
    "internal/",
    "local/",
    "pipeline/",
    "pkg/",
    "proto/",
    "scripts/",
    "workflows/",
)

PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_./@+-])"
    r"([A-Za-z0-9_./@+-]+(?:/[A-Za-z0-9_./@+-]+)+"
    r"|[A-Za-z0-9_./@+-]+\.(?:go|sql|tsx|ts|jsx|js|templ|ya?ml|json|mdx?|proto|graphql|gql|sh|nix|toml|csv|tsv|mod|sum))"
    r"(?![A-Za-z0-9_./@+-])"
)

FRONTMATTER_NAME_RE = re.compile(r"^name:\s*(\S+)\s*$", re.MULTILINE)
PLAN_SLICE_RE = re.compile(r"^##\s+Slice\s+(\d+)\s*:\s*(.+?)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class PatternSpec:
    label: str
    regex: re.Pattern[str]


@dataclass(frozen=True)
class LaneRule:
    lane_id: str
    path_patterns: tuple[PatternSpec, ...] = ()
    text_patterns: tuple[PatternSpec, ...] = ()


@dataclass
class Evidence:
    kind: str
    path: str
    text: str = ""
    route_path: bool = True
    route_text: bool = True


@dataclass
class LaneSelection:
    lane_id: str
    reasons: list[str] = field(default_factory=list)
    matched_evidence: list[str] = field(default_factory=list)

    def add(self, reason: str, evidence: str) -> None:
        if reason not in self.reasons:
            self.reasons.append(reason)
        if evidence not in self.matched_evidence:
            self.matched_evidence.append(evidence)


@dataclass(frozen=True)
class PlanSlice:
    index: int
    title: str


@dataclass(frozen=True)
class StackBranchSpec:
    branch: str
    parent: str | None = None
    slice_index: int | None = None


@dataclass(frozen=True)
class ReviewSlice:
    index: int
    title: str
    branch: str | None = None
    parent: str | None = None
    diff_range: str | None = None
    diff_command: str | None = None
    stat_command: str | None = None
    files_command: str | None = None
    changed_files: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuleMatch:
    path: str
    patterns: tuple[str, ...]
    matched_files: tuple[str, ...]


def rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE | re.MULTILINE)


def p(label: str, pattern: str) -> PatternSpec:
    return PatternSpec(label=label, regex=rx(pattern))


LANE_RULES = [
    LaneRule(
        "q-review-go",
        path_patterns=(
            p("non-test Go source", r"(^|/)(?!.*_test\.go$).*\.go$"),
            p("Go module files", r"(^|/)(go\.mod|go\.sum)$"),
        ),
        text_patterns=(
            p("Go package/concurrency language", r"\b(go package|go module|go\.mod|go\.sum|context\.Context|goroutine|channel|sqlc generated|generated go)\b"),
        ),
    ),
    LaneRule(
        "q-review-go-tests",
        path_patterns=(
            p("Go test file", r"_test\.go$"),
            p("Go integration test file", r"_integration_test\.go$"),
            p("Go test helper/mock/fixture", r"(^|/)(testutil|fixtures|mocks?|mock_.*_test\.go)(/|$)"),
        ),
        text_patterns=(
            p("Go test command or convention", r"\b(go test|gotestsum|integration test|unit test|go-cmp|gocmp|testify|t\.Parallel|testing\.T|//go:build integration|//go:build !integration)\b"),
        ),
    ),
    LaneRule(
        "q-review-temporal",
        path_patterns=(
            p("Temporal workflow path", r"(^|/)workflows(/|$)"),
            p("Temporal worker path", r"(^|/)worker(s)?(/|$)"),
        ),
        text_patterns=(
            p("Temporal workflow/activity language", r"\b(Temporal|go\.temporal|worker registration|child workflow|continue-as-new|workflow id|activity retries?|signal/query/update|task queue)\b"),
        ),
    ),
    LaneRule(
        "q-review-sql",
        path_patterns=(
            p("SQL file", r"\.sql$"),
            p("database migration/query path", r"(^|/)db/(migrations|query|queries|customer|seed)(/|$)"),
            p("sqlc generated or config", r"(^|/)(sqlc\.ya?ml|pkg/db|pkg/types/registry\.go)"),
        ),
        text_patterns=(
            p("concrete SQL/sqlc/migration language", r"\b(sqlc|db/migrations|database migration|sql migration|SQL query|CREATE TYPE|ALTER TYPE|CREATE TABLE|ALTER TABLE|CREATE INDEX|query plan|PostgreSQL enum|enum type|registry\.go|materialized view|RisingWave|sink|source)\b"),
        ),
    ),
    LaneRule(
        "q-review-snowflake",
        path_patterns=(
            p("Snowflake path", r"(^|/)(snowflake|snow)(/|$)"),
        ),
        text_patterns=(
            p("Snowflake warehouse language", r"\b(Snowflake|snow CLI)\b"),
        ),
    ),
    LaneRule(
        "q-review-react-ui",
        path_patterns=(
            p("monorepo frontend app path", r"(^|/)frontend/apps/"),
            p("React component file", r"\.(tsx|jsx)$"),
        ),
        text_patterns=(
            p("React/Next UI language", r"\b(React UI|React component|React/Next|Next\.js|TSX|Bonsai|GrayDialog|React Hook Form|zodResolver|TanStack|React Query|DataTableWithResponseHandling|Playwright|Ranger|Figma)\b"),
        ),
    ),
    LaneRule(
        "q-review-datastar-ui",
        path_patterns=(
            p("cn-agents path", r"(^|/)cn-agents(/|$)"),
            p("templ file", r"\.templ$"),
        ),
        text_patterns=(
            p("Datastar/templ/SSE language", r"\b(Datastar|data-on-|data-init|data-signals|data-bind|PatchElementTempl|PatchSignals|\.templ|templ component|fat morph|morph)\b"),
        ),
    ),
    LaneRule(
        "q-review-data-tables",
        path_patterns=(
            p("table UI path", r"(^|/)(Table|DataTable|data-table|tables?)(/|\.|$)"),
        ),
        text_patterns=(
            p("data table behavior", r"\b(DataTable|data table|saved views?|OpenSearch|table backend|row action|sticky column)\b"),
        ),
    ),
    LaneRule(
        "q-review-identity-fields",
        text_patterns=(
            p("identity/matching semantics", r"\b(identity-bearing|identity fields?|agent matching|producer matching|entity matching)\b"),
        ),
    ),
    LaneRule(
        "q-review-data-ingestion-quality",
        path_patterns=(
            p("ingestion/import path", r"(^|/)(ingestion|etl|pipeline)(/|$)"),
            p("source data file", r"\.(csv|tsv)$"),
        ),
        text_patterns=(
            p("ingestion/source data language", r"\b(CSV|TSV|source data|ETL|import quality|ingestion)\b"),
        ),
    ),
    LaneRule(
        "q-review-ci-workflows",
        path_patterns=(
            p("GitHub Actions workflow", r"(^|/)\.github/workflows/"),
            p("build script", r"(^|/)(justfile|Makefile|Dockerfile|.*\.sh)$"),
        ),
        text_patterns=(
            p("CI/CD language", r"\b(GitHub Actions|CI/CD|workflow file|build script|deployment pipeline|env wiring|justfile)\b"),
        ),
    ),
    LaneRule(
        "q-review-api-auth",
        text_patterns=(
            p("API auth language", r"\b(API auth|DodgyAuth|API keys?|Basic Auth|client IDs?|base62|secret hashing|tenant scoping|auth errors?)\b"),
        ),
    ),
    LaneRule(
        "q-review-error-visibility",
        path_patterns=(
            p("error visibility path", r"(^|/)(error-visibility|issues?|needs-attention)(/|$)"),
        ),
        text_patterns=(
            p("error visibility language", r"\b(error visibility|error queue|issue page|status tooltip|integration UI failure|needs attention|failure surface)\b"),
        ),
    ),
    LaneRule(
        "q-review-docs-health",
        path_patterns=(
            p("documentation file", r"(^|/)(docs|documentation|README|CONTRIBUTING|RUNBOOK|adr|adrs)(/|$)|(^|/)(README|CONTRIBUTING|RUNBOOK|CHANGELOG)\.md$|\.mdx?$"),
            p("local guidance docs", r"(^|/)(AGENTS\.md|CLAUDE\.md|\.agents/rules|\.cursor/rules)(/|$)"),
        ),
        text_patterns=(
            p("documentation language", r"\b(docs?|documentation|README|runbook|ADR|AGENTS\.md|rules?|simplif(?:y|ied|ication)|concise|stale|outdated)\b"),
        ),
    ),
    LaneRule(
        "q-review-integration-ops",
        path_patterns=(
            p("runtime config or migration", r"(^|/)(config|deploy|deployment|ops|observability|db/migrations)(/|$)"),
            p("API/proto contract", r"(^|/)(proto/|pkg/proto/|frontend/packages/proto/|api/internal/testing/).*\.(proto|go|ts)$"),
        ),
        text_patterns=(
            p("ops/integration risk language", r"\b(external call|webhook|rollout|rollback|observability|backfill|deployment|runtime behavior|feature flag)\b"),
        ),
    ),
    LaneRule(
        "q-review-security-invariants",
        text_patterns=(
            p("security/invariant language", r"\b(authn|authz|authorization|permission checks?|trust boundary|privacy|PII|secrets?|tenant scoping|data integrity|invariant)\b"),
        ),
    ),
    LaneRule(
        "q-review-local-best-practices",
        path_patterns=(
            p("local agent/rule guidance changed", r"(^|/)(AGENTS\.md|CLAUDE\.md|\.agents/skills|\.agents/rules|\.cursor/rules|\.claude/skills)(/|$)"),
        ),
        text_patterns=(),
    ),
]


def normalize_path(path: str) -> str:
    path = path.strip().strip("`'\"()[]{}.,:;")
    if path.startswith("file://"):
        path = path[7:]
    path = path.replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    return path


def display_path(path: Path, repo_root: Path | None = None) -> str:
    try:
        if repo_root:
            return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        pass
    return path.as_posix()


def repo_relative_path(path: str, repo_root: Path) -> str:
    normalized = normalize_path(path)
    candidate = Path(normalized)
    if candidate.is_absolute():
        try:
            return candidate.resolve().relative_to(repo_root.resolve()).as_posix()
        except ValueError:
            return normalized
    return normalized


def is_qrspi_artifact_path(path: str) -> bool:
    parts = Path(normalize_path(path)).parts
    if "thoughts" not in parts:
        return False

    # QRSPI/thoughts files are planning evidence, not implementation paths for
    # lane routing. Including changed plan/review docs as changed files causes
    # noisy domain lanes and confuses branch/slice ownership.
    return True


def is_generated_code_path(path: str) -> bool:
    normalized = normalize_path(path)
    return any(pattern.search(normalized) for pattern in GENERATED_PATH_PATTERNS)


def existing_repo_file(path: str, repo_root: Path) -> bool:
    rel = repo_relative_path(path, repo_root)
    if is_qrspi_artifact_path(rel):
        return False

    candidate = Path(rel)
    if candidate.is_absolute():
        return candidate.is_file()

    return (repo_root / candidate).is_file()


def read_text(path: Path, max_bytes: int = 512_000) -> str:
    try:
        if path.is_file() and path.stat().st_size <= max_bytes:
            return path.read_text(errors="replace")
    except OSError:
        pass
    return ""


def run(cmd: list[str], cwd: Path) -> str:
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except OSError:
        return ""
    if proc.returncode != 0:
        return ""
    return proc.stdout


def discover_repo_root(cwd: Path) -> Path:
    out = run(["git", "rev-parse", "--show-toplevel"], cwd)
    if out.strip():
        return Path(out.strip()).resolve()
    return cwd.resolve()


def discover_lane_ids() -> list[str]:
    discovered: set[str] = set()
    if AGENTS_DIR.exists():
        for prompt in AGENTS_DIR.glob("q-review-*.md"):
            text = read_text(prompt)
            match = FRONTMATTER_NAME_RE.search(text)
            discovered.add(match.group(1) if match else prompt.stem)

    ordered = [lane for lane in LANE_ORDER if lane in discovered]
    ordered.extend(sorted(discovered - set(ordered)))
    return ordered


def is_high_confidence_path(path: str) -> bool:
    suffix = Path(path).suffix.lower()
    if suffix in TEXT_FILE_EXTENSIONS:
        return True

    if path.startswith("/"):
        # Treat slash-leading strings like /settings or /config as routes, not repo paths.
        return False

    return path.startswith(KNOWN_PATH_PREFIXES)


def extract_paths(text: str) -> list[str]:
    paths: list[str] = []
    seen: set[str] = set()
    for match in PATH_RE.finditer(text):
        raw = normalize_path(match.group(1))
        if not raw or raw.startswith(("http://", "https://")):
            continue
        if ".." in Path(raw).parts:
            continue
        if not is_high_confidence_path(raw):
            continue
        if raw not in seen:
            seen.add(raw)
            paths.append(raw)
    return paths


def diff_spec(diff_range: str | None, diff_base: str | None, diff_target: str = "HEAD") -> str | None:
    if diff_range:
        return diff_range
    if diff_base:
        return f"{diff_base}..{diff_target}"
    return None


def git_diff_for_file(
    repo_root: Path,
    rel: str,
    diff_range: str | None = None,
    diff_base: str | None = None,
    diff_target: str = "HEAD",
) -> str:
    spec = diff_spec(diff_range, diff_base, diff_target)
    if spec:
        return run(["git", "diff", spec, "--", rel], repo_root)

    staged = run(["git", "diff", "--cached", "--", rel], repo_root)
    unstaged = run(["git", "diff", "--", rel], repo_root)
    return staged + "\n" + unstaged


def path_matches_scope(path: str, scope_prefixes: Iterable[str]) -> bool:
    prefixes = [normalize_path(prefix).rstrip("/") for prefix in scope_prefixes if normalize_path(prefix)]
    if not prefixes:
        return True
    normalized = normalize_path(path)
    return any(normalized == prefix or normalized.startswith(prefix + "/") for prefix in prefixes)


def git_changed_files_for_range(
    repo_root: Path,
    diff_range: str,
    scope_prefixes: Iterable[str] = (),
) -> list[str]:
    return sorted(
        {
            rel
            for line in run(["git", "diff", "--name-only", diff_range], repo_root).splitlines()
            if line.strip()
            for rel in [repo_relative_path(line, repo_root)]
            if not is_qrspi_artifact_path(rel) and path_matches_scope(rel, scope_prefixes)
        }
    )


def git_changed_files(
    repo_root: Path,
    diff_range: str | None = None,
    diff_base: str | None = None,
    diff_target: str = "HEAD",
) -> list[str]:
    files: set[str] = set()

    if diff_range:
        diff_cmds = [["git", "diff", "--name-only", diff_range]]
    elif diff_base:
        diff_cmds = [["git", "diff", "--name-only", f"{diff_base}..{diff_target}"]]
    else:
        diff_cmds = [["git", "diff", "--name-only"], ["git", "diff", "--cached", "--name-only"]]

    for cmd in diff_cmds:
        for line in run(cmd, repo_root).splitlines():
            path = repo_relative_path(line, repo_root)
            if path and not is_qrspi_artifact_path(path):
                files.add(path)

    # Always include uncommitted status in addition to an explicit range so the
    # review sees local edits made after the last commit.
    for line in run(["git", "status", "--porcelain"], repo_root).splitlines():
        if len(line) < 4:
            continue
        path = repo_relative_path(line[3:], repo_root)
        if " -> " in path:
            path = repo_relative_path(path.split(" -> ", 1)[1], repo_root)
        if path and not is_qrspi_artifact_path(path):
            files.add(path)

    return sorted(files)


def parse_plan_slices(plan_dir: Path | None) -> list[PlanSlice]:
    if not plan_dir:
        return []
    plan_path = plan_dir / "plan.md"
    text = read_text(plan_path, max_bytes=512_000)
    slices: list[PlanSlice] = []
    for match in PLAN_SLICE_RE.finditer(text):
        slices.append(PlanSlice(index=int(match.group(1)), title=match.group(2).strip()))
    return slices


def implementation_scope_prefixes(plan_dir: Path | None, repo_root: Path) -> list[str]:
    if not plan_dir:
        return []
    prefixes: set[str] = set()
    for name in ("design.md", "outline.md", "plan.md"):
        text = read_text(plan_dir / name, max_bytes=512_000)
        for extracted in extract_paths(text):
            rel = repo_relative_path(extracted, repo_root)
            if not rel or is_qrspi_artifact_path(rel):
                continue
            path = Path(rel)
            if path.suffix.lower() in TEXT_FILE_EXTENSIONS:
                parent = path.parent.as_posix()
                if parent and parent != ".":
                    prefixes.add(parent)
                else:
                    prefixes.add(rel)
            else:
                prefixes.add(rel.rstrip("/"))
    return sorted(prefixes)


def parse_stack_branch_spec(spec: str) -> StackBranchSpec:
    raw = spec.strip()
    if not raw:
        raise SystemExit("--stack-branch values cannot be empty")

    slice_index: int | None = None
    body = raw
    prefix_match = re.match(r"^(?:slice[-_ ]*)?(\d+)=(.+)$", raw, re.IGNORECASE)
    if prefix_match:
        slice_index = int(prefix_match.group(1))
        body = prefix_match.group(2).strip()

    parent: str | None = None
    branch = body
    if ".." in body:
        parent, branch = [part.strip() for part in body.split("..", 1)]

    if not branch:
        raise SystemExit(f"invalid --stack-branch value: {spec!r}")
    return StackBranchSpec(branch=branch, parent=parent or None, slice_index=slice_index)


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def build_review_slices(
    plan_dir: Path | None,
    repo_root: Path,
    stack_branch_specs: list[str],
) -> list[ReviewSlice]:
    plan_slices = parse_plan_slices(plan_dir)
    scope_prefixes = implementation_scope_prefixes(plan_dir, repo_root)
    specs = [parse_stack_branch_spec(spec) for spec in stack_branch_specs]

    if not specs:
        return [ReviewSlice(index=s.index, title=s.title) for s in plan_slices]

    by_index = {s.index: s for s in plan_slices}
    review_slices: list[ReviewSlice] = []
    for offset, spec in enumerate(specs, start=1):
        slice_index = spec.slice_index or offset
        plan_slice = by_index.get(slice_index)
        title = plan_slice.title if plan_slice else f"Branch {spec.branch}"
        diff_range = f"{spec.parent}..{spec.branch}" if spec.parent else None
        changed_files = tuple(git_changed_files_for_range(repo_root, diff_range, scope_prefixes)) if diff_range else ()
        branch_q = shell_quote(spec.branch)
        parent_q = shell_quote(spec.parent) if spec.parent else None
        review_slices.append(
            ReviewSlice(
                index=slice_index,
                title=title,
                branch=spec.branch,
                parent=spec.parent,
                diff_range=diff_range,
                diff_command=(
                    f"git diff {parent_q}..{branch_q}"
                    if parent_q
                    else f"gt info --branch {branch_q} --diff --no-interactive"
                ),
                stat_command=(
                    f"git diff --stat {parent_q}..{branch_q}"
                    if parent_q
                    else f"gt info --branch {branch_q} --stat --no-interactive"
                ),
                files_command=(
                    f"git diff --name-only {parent_q}..{branch_q}"
                    if parent_q
                    else f"gt info --branch {branch_q} --stat --no-interactive"
                ),
                changed_files=changed_files,
            )
        )

    return sorted(review_slices, key=lambda s: s.index)


def review_slice_to_json(review_slice: ReviewSlice) -> dict[str, object]:
    return {
        "index": review_slice.index,
        "title": review_slice.title,
        "branch": review_slice.branch,
        "parent": review_slice.parent,
        "diff_range": review_slice.diff_range,
        "diff_command": review_slice.diff_command,
        "stat_command": review_slice.stat_command,
        "files_command": review_slice.files_command,
        "changed_files": list(review_slice.changed_files),
    }


def newest_implementation_handoff(plan_dir: Path) -> Path | None:
    handoff_dir = plan_dir / "handoffs"
    if not handoff_dir.is_dir():
        return None
    candidates = []
    for path in handoff_dir.glob("*.md"):
        text = read_text(path, max_bytes=128_000).lower()
        if "implement" in path.name.lower() and ("complete" in text or "implementation" in text):
            candidates.append(path)
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def build_outline_evidence(plan_dir: Path, repo_root: Path) -> tuple[list[Evidence], list[str]]:
    evidence: list[Evidence] = []
    referenced_paths: list[str] = []
    for name in ("design.md", "design-product.md", "outline.md", "plan.md"):
        path = plan_dir / name
        if not path.is_file():
            continue
        text = read_text(path)
        evidence.append(Evidence(kind="review_doc", path=display_path(path, repo_root), text=text, route_path=False))
        referenced_paths.extend(extract_paths(text))
    return evidence, sorted(set(referenced_paths))


def build_implementation_evidence(
    plan_dir: Path | None,
    repo_root: Path,
    reviewed_artifact: Path | None,
    handoff: Path | None,
    explicit_changed_files: list[str],
    diff_range: str | None = None,
    diff_base: str | None = None,
    diff_target: str = "HEAD",
) -> tuple[list[Evidence], list[str]]:
    evidence: list[Evidence] = []
    changed: set[str] = {
        rel
        for path in explicit_changed_files
        if normalize_path(path)
        for rel in [repo_relative_path(path, repo_root)]
        if not is_qrspi_artifact_path(rel) and not is_generated_code_path(rel)
    }

    handoff_path = handoff or reviewed_artifact
    if not handoff_path and plan_dir:
        handoff_path = newest_implementation_handoff(plan_dir)

    if handoff_path and handoff_path.is_file():
        text = read_text(handoff_path)
        # Handoffs are evidence artifacts, not implementation artifacts. Use their
        # extracted repo paths to discover changed files, but do not route lanes from
        # handoff path or prose; otherwise review summaries can over-select domains.
        evidence.append(
            Evidence(
                kind="handoff",
                path=display_path(handoff_path, repo_root),
                text=text,
                route_path=False,
                route_text=False,
            )
        )
        for extracted in extract_paths(text):
            rel = repo_relative_path(extracted, repo_root)
            if existing_repo_file(rel, repo_root) and not is_generated_code_path(rel):
                changed.add(rel)

    changed.update(
        path
        for path in git_changed_files(
            repo_root,
            diff_range=diff_range,
            diff_base=diff_base,
            diff_target=diff_target,
        )
        if not is_generated_code_path(path)
    )

    normalized_changed = sorted(
        path
        for path in changed
        if path and not is_qrspi_artifact_path(path) and not is_generated_code_path(path)
    )
    for rel in normalized_changed:
        file_path = (repo_root / rel).resolve() if not Path(rel).is_absolute() else Path(rel)
        text = ""
        if file_path.suffix.lower() in TEXT_FILE_EXTENSIONS:
            # Route text-pattern lanes from the changed hunks, not the whole file.
            # Whole-file scanning over-selects lanes because existing imports,
            # generated comments, or unrelated functions mention domains untouched by
            # the reviewed diff.
            text = git_diff_for_file(
                repo_root,
                rel,
                diff_range=diff_range,
                diff_base=diff_base,
                diff_target=diff_target,
            ) or read_text(file_path, max_bytes=64_000)
        evidence.append(Evidence(kind="changed_file", path=rel, text=text))

    return evidence, normalized_changed


def parse_rule_paths_frontmatter(text: str) -> tuple[str, ...]:
    if not text.startswith("---"):
        return ()

    end = text.find("\n---", 3)
    if end == -1:
        return ()

    frontmatter = text[3:end]
    for line in frontmatter.splitlines():
        if not line.startswith("paths:"):
            continue
        raw_patterns = line.removeprefix("paths:").strip()
        return tuple(
            pattern.strip().strip("'\"")
            for pattern in raw_patterns.split(",")
            if pattern.strip()
        )

    return ()


def discover_rule_matches(repo_root: Path, candidate_paths: Iterable[str]) -> list[RuleMatch]:
    normalized_candidates = sorted(
        {
            normalize_path(path)
            for path in candidate_paths
            if normalize_path(path) and not is_generated_code_path(normalize_path(path))
        }
    )
    if not normalized_candidates:
        return []

    rule_files: list[Path] = []
    for rules_dir in (repo_root / ".agents" / "rules",):
        if not rules_dir.exists():
            continue
        rule_files.extend(
            path
            for path in rules_dir.rglob("*")
            if path.is_file() and path.suffix in {".md", ".mdc"}
        )

    matches: list[RuleMatch] = []
    for rule_file in sorted(set(rule_files)):
        text = read_text(rule_file)
        patterns = parse_rule_paths_frontmatter(text)
        if not patterns:
            continue
        matched_files = tuple(
            candidate
            for candidate in normalized_candidates
            if any(fnmatch.fnmatch(candidate, pattern) for pattern in patterns)
        )
        if not matched_files:
            continue
        matches.append(
            RuleMatch(
                path=display_path(rule_file, repo_root),
                patterns=patterns,
                matched_files=matched_files,
            )
        )

    return matches


def add_codebase_rules_lane(
    selection: dict[str, object],
    rule_matches: list[RuleMatch],
    all_lane_ids: list[str],
) -> dict[str, object]:
    if not rule_matches or "q-review-codebase-rules" not in all_lane_ids:
        return selection

    selected_lanes = list(selection["selected_lanes"])  # type: ignore[index]
    if any(lane["id"] == "q-review-codebase-rules" for lane in selected_lanes):
        return selection

    selected_lanes.append(
        {
            "id": "q-review-codebase-rules",
            "reasons": [
                "selected because changed/referenced files match local rule frontmatter"
            ],
            "matched_evidence": [
                f"{match.path} -> {', '.join(match.matched_files)}"
                for match in rule_matches
            ],
        }
    )
    order = {lane_id: index for index, lane_id in enumerate(all_lane_ids)}
    selected_lanes.sort(key=lambda lane: order.get(str(lane["id"]), len(order)))
    selected_ids = {str(lane["id"]) for lane in selected_lanes}

    selection = dict(selection)
    selection["selected_lanes"] = selected_lanes
    selection["skipped_lanes"] = [
        lane
        for lane in selection["skipped_lanes"]  # type: ignore[index]
        if str(lane["id"]) not in selected_ids
    ]

    return selection


def rule_matches_to_json(rule_matches: list[RuleMatch]) -> list[dict[str, object]]:
    return [
        {
            "path": match.path,
            "patterns": list(match.patterns),
            "matched_files": list(match.matched_files),
        }
        for match in rule_matches
    ]


def select_lanes(mode: str, evidence: list[Evidence], changed_files: list[str], all_lane_ids: list[str]) -> dict[str, object]:
    selected: dict[str, LaneSelection] = {}

    def add_lane(lane_id: str, reason: str, evidence_path: str = "default") -> None:
        if lane_id not in all_lane_ids:
            return
        selection = selected.setdefault(lane_id, LaneSelection(lane_id=lane_id))
        selection.add(reason, evidence_path)

    if mode == "outline":
        add_lane("q-review-intent-fit", "default outline review lane")
        add_lane("q-review-project-guidance", "default outline review lane")
        add_lane("q-review-docs-health", "default outline review lane")
        add_lane("q-review-tests-verification", "default outline review lane")
    else:
        add_lane("q-review-correctness", "default implementation review lane")
        add_lane("q-review-project-guidance", "default implementation review lane")
        add_lane("q-review-docs-health", "default implementation review lane")
        add_lane("q-review-tests-verification", "default implementation review lane")

    for rule in LANE_RULES:
        for item in evidence:
            if item.route_path:
                for spec in rule.path_patterns:
                    if spec.regex.search(item.path):
                        add_lane(rule.lane_id, f"matched {spec.label}: {item.path}", item.path)
            if item.route_text:
                for spec in rule.text_patterns:
                    if spec.regex.search(item.text):
                        add_lane(rule.lane_id, f"matched {spec.label} in {item.path}", item.path)

    selected_domain_lanes = {
        lane_id
        for lane_id in selected
        if lane_id
        not in {
            "q-review-intent-fit",
            "q-review-correctness",
            "q-review-tests-verification",
            "q-review-project-guidance",
            "q-review-docs-health",
            "q-review-integration-ops",
            "q-review-security-invariants",
            "q-review-maintainability",
        }
    }
    if len(selected_domain_lanes) >= 3:
        add_lane("q-review-maintainability", "selected because three or more domain lanes matched")
    if len(changed_files) >= 10:
        add_lane("q-review-maintainability", "selected because implementation changes touch ten or more files")

    ordered_selected_ids = [lane for lane in all_lane_ids if lane in selected]
    skipped_ids = [lane for lane in all_lane_ids if lane not in selected]

    return {
        "selected_lanes": [
            {
                "id": lane_id,
                "reasons": selected[lane_id].reasons,
                "matched_evidence": selected[lane_id].matched_evidence,
            }
            for lane_id in ordered_selected_ids
        ],
        "skipped_lanes": [
            {
                "id": lane_id,
                "reason": "no selector rule matched current review evidence",
            }
            for lane_id in skipped_ids
        ],
    }


def build_subagent_tool_args(
    *,
    mode: str,
    repo_root: Path,
    plan_dir: Path | None,
    reviewed_artifact: Path | None,
    review_dir: Path,
    changed_files: list[str],
    referenced_paths: list[str],
    evidence_files: list[str],
    selected_lanes: list[dict[str, object]],
    review_slices: list[ReviewSlice],
    rule_matches: list[RuleMatch],
) -> dict[str, object]:
    focused_lanes_dir = review_dir / "focused-lanes"
    chain_dir = review_dir / "focused-lane-runs"
    parallel_tasks: list[dict[str, object]] = []

    for lane in selected_lanes:
        lane_id = str(lane["id"])
        prompt_path = AGENTS_DIR / f"{lane_id}.md"
        prompt_text = read_text(prompt_path)
        if not prompt_text:
            prompt_text = f"# {lane_id}\n\nPrompt file not found at {prompt_path.as_posix()}."

        reasons = lane.get("reasons", [])
        matched = lane.get("matched_evidence", [])
        slice_lines: list[str] = []
        if review_slices:
            for review_slice in review_slices:
                branch = f" branch={review_slice.branch}" if review_slice.branch else ""
                parent = f" parent={review_slice.parent}" if review_slice.parent else ""
                diff = f" diff_command={review_slice.diff_command}" if review_slice.diff_command else ""
                files = f" changed_files={', '.join(review_slice.changed_files)}" if review_slice.changed_files else ""
                slice_lines.append(f"- Slice {review_slice.index}: {review_slice.title}{branch}{parent}{diff}{files}")
        review_slices_text = "\n".join(slice_lines) if slice_lines else "none"
        rule_matches_text = json.dumps(rule_matches_to_json(rule_matches), ensure_ascii=False)
        task = (
            "Use this focused lane prompt exactly. The prompt is embedded below; do not search for a lane prompt file.\n\n"
            "Pi subagent runtime contract: use only tools available to your agent, especially bash/read when present. "
            "Do not output tool-call XML, JSON tool invocations, or proposed commands as your answer. "
            "Actually run bounded searches/reads/verification and then return the lane report. "
            "Return markdown only, not a transcript. If a needed tool is unavailable or context is insufficient after bounded reads, report the gap in the lane report.\n\n"
            f"{prompt_text}\n\n"
            f"Review only this lane for {mode} review. "
            f"cwd={repo_root.as_posix()}. "
            f"repo_root={repo_root.as_posix()}. "
            f"plan_dir={plan_dir.as_posix() if plan_dir else 'none'}. "
            f"reviewed_artifact={reviewed_artifact.as_posix() if reviewed_artifact else 'none'}.\n\n"
            f"Changed files: {', '.join(changed_files) if changed_files else 'none'}.\n"
            f"Referenced paths: {', '.join(referenced_paths) if referenced_paths else 'none'}.\n"
            f"Evidence files: {', '.join(evidence_files) if evidence_files else 'none'}.\n"
            f"Review slices and branch diff commands:\n{review_slices_text}\n"
            f"Relevant local rule files matched by frontmatter: {rule_matches_text}.\n"
            f"Selector reasons for this lane: {json.dumps(reasons, ensure_ascii=False)}.\n"
            f"Matched evidence for this lane: {json.dumps(matched, ensure_ascii=False)}.\n\n"
            "If review slices are listed, review and report each slice separately. Use the provided per-slice diff command before broad discovery when a branch is listed. "
            "Your report MUST include a `## Slice Reviews` section with one `### Slice N: title` subsection per listed slice. "
            "Under each slice subsection, write lane-specific findings for that slice or exactly `No findings.`. This lets the orchestrator fold fixes into the correct Graphite branch.\n\n"
            "Operational limits: aim to complete this focused lane in under 5 minutes; if that is not possible, "
            "write a partial report with the blocking gap instead of continuing broad discovery. Run all bash commands from cwd/repo_root; "
            "use short explicit timeouts for broad discovery commands, and task-appropriate explicit timeouts for verification commands. "
            "Never run `find` outside cwd/repo_root or $TMPDIR; prefer exact provided paths and `rg --files` scoped to cwd. "
            "If context is insufficient after bounded reads, report the gap instead of broad discovery.\n\n"
            "The final answer and output file must start with the lane report heading from the embedded prompt and include Findings, What I Read, Verification, and Notes for Main Reviewer sections. "
            "Do not include raw `<tool_call>` blocks, JSON command objects, or unevaluated shell snippets as the report body. "
            "Write the lane report to the provided output path. Do not edit implementation files."
        )
        parallel_tasks.append(
            {
                "agent": "reviewer",
                "task": task,
                "cwd": repo_root.as_posix(),
                "output": (focused_lanes_dir / f"{lane_id}.md").as_posix(),
                "reads": False,
                "progress": False,
            }
        )

    return {
        "chain": [{"parallel": parallel_tasks}],
        "chainDir": chain_dir.as_posix(),
        "clarify": False,
        "control": {
            "needsAttentionAfterMs": 300000,
            "activeNoticeAfterMs": 300000,
            "notifyOn": ["needs_attention", "active_long_running"],
        },
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Select q-review focused lanes deterministically")
    parser.add_argument("--mode", choices=("outline", "implementation"), help="review mode")
    parser.add_argument("--plan-dir", type=Path, help="QRSPI plan directory")
    parser.add_argument("--reviewed-artifact", type=Path, help="outline.md or implementation handoff path")
    parser.add_argument("--handoff", type=Path, help="implementation handoff path")
    parser.add_argument("--repo-root", type=Path, help="repository root; defaults to git root from cwd")
    parser.add_argument("--review-dir", type=Path, help="timestamped review directory; enables exact subagent_tool_args output")
    parser.add_argument("--changed-file", action="append", default=[], help="explicit implementation changed file; may be repeated")
    parser.add_argument(
        "--stack-branch",
        action="append",
        default=[],
        help=(
            "Graphite stack branch/slice to review; may be repeated from bottom to top. "
            "Accepted forms: BRANCH, PARENT..BRANCH, N=BRANCH, or N=PARENT..BRANCH. "
            "When PARENT is supplied, subagents get git diff/stat/name-only commands for that slice."
        ),
    )
    parser.add_argument("--diff-range", help="implementation diff range for committed changes, e.g. BASE..HEAD")
    parser.add_argument("--diff-base", help="implementation diff base commit; uses BASE..diff-target")
    parser.add_argument("--diff-target", default="HEAD", help="implementation diff target when --diff-base is used; default HEAD")
    parser.add_argument("--pretty", action="store_true", help="pretty-print JSON output")
    parser.add_argument("--self-test", action="store_true", help="run built-in selector tests")
    return parser.parse_args(argv)


def run_selector(args: argparse.Namespace) -> dict[str, object]:
    cwd = Path.cwd()
    repo_root = (args.repo_root.resolve() if args.repo_root else discover_repo_root(cwd))
    plan_dir = args.plan_dir.resolve() if args.plan_dir else None
    reviewed_artifact = args.reviewed_artifact.resolve() if args.reviewed_artifact else None
    handoff = args.handoff.resolve() if args.handoff else None
    review_dir = args.review_dir.resolve() if args.review_dir else None

    if not args.mode:
        raise SystemExit("--mode is required unless --self-test is used")
    if args.mode == "outline" and not plan_dir:
        raise SystemExit("--plan-dir is required for outline mode")

    all_lane_ids = discover_lane_ids()

    review_slices = build_review_slices(plan_dir, repo_root, args.stack_branch)
    stack_changed_files = sorted(
        {
            path
            for review_slice in review_slices
            for path in review_slice.changed_files
            if path and not is_generated_code_path(path)
        }
    )

    if args.mode == "outline":
        evidence, referenced_paths = build_outline_evidence(plan_dir, repo_root)
        for rel in referenced_paths:
            evidence.append(Evidence(kind="referenced_path", path=rel, text=""))
        changed_files: list[str] = []
        evidence_files = [item.path for item in evidence if item.kind == "review_doc"]
    else:
        evidence, changed_files = build_implementation_evidence(
            plan_dir=plan_dir,
            repo_root=repo_root,
            reviewed_artifact=reviewed_artifact,
            handoff=handoff,
            explicit_changed_files=[*args.changed_file, *stack_changed_files],
            diff_range=args.diff_range,
            diff_base=args.diff_base,
            diff_target=args.diff_target,
        )
        if stack_changed_files and not args.diff_range and not args.diff_base:
            changed_files = stack_changed_files
        referenced_paths = []
        evidence_files = [item.path for item in evidence if item.kind == "handoff"]

    rule_candidate_paths = [*changed_files, *referenced_paths]
    rule_matches = discover_rule_matches(repo_root, rule_candidate_paths)
    selection = select_lanes(args.mode, evidence, changed_files, all_lane_ids)
    selection = add_codebase_rules_lane(selection, rule_matches, all_lane_ids)

    result: dict[str, object] = {
        "version": 2,
        "mode": args.mode,
        "repo_root": repo_root.as_posix(),
        "plan_dir": plan_dir.as_posix() if plan_dir else None,
        "review_dir": review_dir.as_posix() if review_dir else None,
        "reviewed_artifact": reviewed_artifact.as_posix() if reviewed_artifact else None,
        "evidence_files": evidence_files,
        "changed_files": changed_files,
        "referenced_paths": referenced_paths,
        "relevant_rules": rule_matches_to_json(rule_matches),
        "review_slices": [review_slice_to_json(review_slice) for review_slice in review_slices],
        "diff_range": args.diff_range,
        "diff_base": args.diff_base,
        "diff_target": args.diff_target,
        **selection,
    }

    if review_dir:
        result["subagent_tool_args"] = build_subagent_tool_args(
            mode=args.mode,
            repo_root=repo_root,
            plan_dir=plan_dir,
            reviewed_artifact=reviewed_artifact,
            review_dir=review_dir,
            changed_files=changed_files,
            referenced_paths=referenced_paths,
            evidence_files=evidence_files,
            selected_lanes=selection["selected_lanes"],  # type: ignore[arg-type]
            review_slices=review_slices,
            rule_matches=rule_matches,
        )

    return result


def assert_lanes(result: dict[str, object], expected: set[str], unexpected: set[str] = frozenset()) -> None:
    selected = {item["id"] for item in result["selected_lanes"]}  # type: ignore[index]
    missing = expected - selected
    extra = unexpected & selected
    if missing or extra:
        raise AssertionError(f"selected={sorted(selected)} missing={sorted(missing)} extra={sorted(extra)}")


def self_test() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp)
        agents = AGENTS_DIR
        if not agents.exists():
            raise AssertionError(f"missing agents dir: {agents}")

        plan = repo / "thoughts" / "plans" / "2026_test"
        plan.mkdir(parents=True)
        (plan / "design.md").write_text("React form in frontend/apps/web/app/foo/page.tsx uses GrayDialog.\n")
        (plan / "outline.md").write_text("Add db/migrations/20260101_add_enum.sql and sqlc query.\n")
        (plan / "plan.md").write_text("Add api/internal/foo/foo_integration_test.go with go-cmp.\n")
        args = argparse.Namespace(
            mode="outline",
            plan_dir=plan,
            reviewed_artifact=None,
            handoff=None,
            repo_root=repo,
            review_dir=None,
            changed_file=[],
            stack_branch=[],
            diff_range=None,
            diff_base=None,
            diff_target="HEAD",
            pretty=False,
            self_test=False,
        )
        result = run_selector(args)
        assert_lanes(
            result,
            {
                "q-review-intent-fit",
                "q-review-tests-verification",
                "q-review-react-ui",
                "q-review-sql",
                "q-review-go-tests",
            },
            {"q-review-datastar-ui"},
        )

        impl_plan = repo / "impl"
        impl_plan.mkdir()
        (repo / "cn-agents" / "pkg" / "ui").mkdir(parents=True)
        (repo / "cn-agents" / "pkg" / "ui" / "panel.templ").write_text("package ui\n")
        (repo / "cn-agents" / "pkg" / "ui" / "stream.go").write_text("package ui\n")
        handoff = impl_plan / "handoffs" / "handoff.md"
        handoff.parent.mkdir()
        handoff.write_text(
            "Changed files:\n"
            "- cn-agents/pkg/ui/panel.templ\n"
            "- cn-agents/pkg/ui/stream.go\n"
            "Uses Datastar PatchElementTempl over SSE.\n"
        )
        args = argparse.Namespace(
            mode="implementation",
            plan_dir=impl_plan,
            reviewed_artifact=handoff,
            handoff=None,
            repo_root=repo,
            review_dir=None,
            changed_file=[],
            stack_branch=[],
            diff_range=None,
            diff_base=None,
            diff_target="HEAD",
            pretty=False,
            self_test=False,
        )
        result = run_selector(args)
        assert_lanes(
            result,
            {
                "q-review-correctness",
                "q-review-tests-verification",
                "q-review-datastar-ui",
                "q-review-go",
            },
            {"q-review-react-ui"},
        )

    print("self-test passed")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        self_test()
        return 0

    result = run_selector(args)
    indent = 2 if args.pretty else None
    print(json.dumps(result, indent=indent, sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
