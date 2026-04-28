#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Deterministically select q-review focused lanes.

The selector is intentionally dependency-free and conservative. It routes from:
- outline mode: design.md, outline.md, and optional plan.md only
- implementation mode: explicit changed files, implement handoff paths, and git diff/status

It does not read questions/, research/, or context/ for lane selection.
"""

from __future__ import annotations

import argparse
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
            p("PostgreSQL/sqlc/migration language", r"\b(sqlc|postgres(ql)?|db/migrations|database migration|sql migration|CREATE TYPE|ALTER TYPE|CREATE TABLE|ALTER TABLE|CREATE INDEX|backfill|query plan|enum type|registry\.go)\b"),
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
            p("monorepo frontend path", r"(^|/)frontend(/|$)"),
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
        "q-review-integration-ops",
        path_patterns=(
            p("runtime config or migration", r"(^|/)(config|deploy|deployment|ops|observability|db/migrations)(/|$)"),
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


def git_changed_files(repo_root: Path) -> list[str]:
    files: set[str] = set()

    for cmd in (["git", "diff", "--name-only"], ["git", "diff", "--cached", "--name-only"]):
        for line in run(cmd, repo_root).splitlines():
            path = normalize_path(line)
            if path:
                files.add(path)

    for line in run(["git", "status", "--porcelain"], repo_root).splitlines():
        if len(line) < 4:
            continue
        path = normalize_path(line[3:])
        if " -> " in path:
            path = normalize_path(path.split(" -> ", 1)[1])
        if path:
            files.add(path)

    return sorted(files)


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
    for name in ("design.md", "outline.md", "plan.md"):
        path = plan_dir / name
        if not path.is_file():
            continue
        text = read_text(path)
        evidence.append(Evidence(kind="review_doc", path=display_path(path, repo_root), text=text))
        referenced_paths.extend(extract_paths(text))
    return evidence, sorted(set(referenced_paths))


def build_implementation_evidence(
    plan_dir: Path | None,
    repo_root: Path,
    reviewed_artifact: Path | None,
    handoff: Path | None,
    explicit_changed_files: list[str],
) -> tuple[list[Evidence], list[str]]:
    evidence: list[Evidence] = []
    changed: set[str] = {normalize_path(path) for path in explicit_changed_files if normalize_path(path)}

    handoff_path = handoff or reviewed_artifact
    if not handoff_path and plan_dir:
        handoff_path = newest_implementation_handoff(plan_dir)

    if handoff_path and handoff_path.is_file():
        text = read_text(handoff_path)
        evidence.append(Evidence(kind="handoff", path=display_path(handoff_path, repo_root), text=text))
        changed.update(extract_paths(text))

    changed.update(git_changed_files(repo_root))

    normalized_changed = sorted(path for path in changed if path)
    for rel in normalized_changed:
        file_path = (repo_root / rel).resolve() if not Path(rel).is_absolute() else Path(rel)
        text = ""
        if file_path.suffix.lower() in TEXT_FILE_EXTENSIONS:
            text = read_text(file_path)
        evidence.append(Evidence(kind="changed_file", path=rel, text=text))

    return evidence, normalized_changed


def select_lanes(mode: str, evidence: list[Evidence], changed_files: list[str], all_lane_ids: list[str]) -> dict[str, object]:
    selected: dict[str, LaneSelection] = {}

    def add_lane(lane_id: str, reason: str, evidence_path: str = "default") -> None:
        if lane_id not in all_lane_ids:
            return
        selection = selected.setdefault(lane_id, LaneSelection(lane_id=lane_id))
        selection.add(reason, evidence_path)

    if mode == "outline":
        add_lane("q-review-intent-fit", "default outline review lane")
        add_lane("q-review-tests-verification", "default outline review lane")
    else:
        add_lane("q-review-correctness", "default implementation review lane")
        add_lane("q-review-tests-verification", "default implementation review lane")

    for rule in LANE_RULES:
        for item in evidence:
            for spec in rule.path_patterns:
                if spec.regex.search(item.path):
                    add_lane(rule.lane_id, f"matched {spec.label}: {item.path}", item.path)
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


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Select q-review focused lanes deterministically")
    parser.add_argument("--mode", choices=("outline", "implementation"), help="review mode")
    parser.add_argument("--plan-dir", type=Path, help="QRSPI plan directory")
    parser.add_argument("--reviewed-artifact", type=Path, help="outline.md or implementation handoff path")
    parser.add_argument("--handoff", type=Path, help="implementation handoff path")
    parser.add_argument("--repo-root", type=Path, help="repository root; defaults to git root from cwd")
    parser.add_argument("--changed-file", action="append", default=[], help="explicit implementation changed file; may be repeated")
    parser.add_argument("--pretty", action="store_true", help="pretty-print JSON output")
    parser.add_argument("--self-test", action="store_true", help="run built-in selector tests")
    return parser.parse_args(argv)


def run_selector(args: argparse.Namespace) -> dict[str, object]:
    cwd = Path.cwd()
    repo_root = (args.repo_root.resolve() if args.repo_root else discover_repo_root(cwd))
    plan_dir = args.plan_dir.resolve() if args.plan_dir else None
    reviewed_artifact = args.reviewed_artifact.resolve() if args.reviewed_artifact else None
    handoff = args.handoff.resolve() if args.handoff else None

    if not args.mode:
        raise SystemExit("--mode is required unless --self-test is used")
    if args.mode == "outline" and not plan_dir:
        raise SystemExit("--plan-dir is required for outline mode")

    all_lane_ids = discover_lane_ids()

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
            explicit_changed_files=args.changed_file,
        )
        referenced_paths = []
        evidence_files = [item.path for item in evidence if item.kind == "handoff"]

    selection = select_lanes(args.mode, evidence, changed_files, all_lane_ids)

    return {
        "version": 1,
        "mode": args.mode,
        "repo_root": repo_root.as_posix(),
        "plan_dir": plan_dir.as_posix() if plan_dir else None,
        "reviewed_artifact": reviewed_artifact.as_posix() if reviewed_artifact else None,
        "evidence_files": evidence_files,
        "changed_files": changed_files,
        "referenced_paths": referenced_paths,
        **selection,
    }


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
            changed_file=[],
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
            changed_file=[],
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
