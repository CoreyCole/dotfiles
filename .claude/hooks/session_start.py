#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import json
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def log_session_start(input_data):
    """Log session start event to logs directory."""
    # Ensure logs directory exists
    log_dir = Path.home() / ".claude" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "session_start.json"

    # Read existing log data or initialize empty list
    if log_file.exists():
        with open(log_file, "r") as f:
            try:
                log_data = json.load(f)
            except (json.JSONDecodeError, ValueError):
                log_data = []
    else:
        log_data = []

    # Append the entire input data
    log_data.append(input_data)

    # Write back to file with formatting
    with open(log_file, "w") as f:
        json.dump(log_data, f, indent=2)


def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())

        # Log the session start event
        log_session_start(input_data)

        # Success
        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)


if __name__ == "__main__":
    main()

