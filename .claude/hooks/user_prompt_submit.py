#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def log_user_prompt(input_data, duration_ms):
    """Log user prompt to logs directory."""
    # Ensure logs directory exists
    log_dir = Path.home() / Path(".claude/logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "user_prompt_submit.json"

    # Read existing log data or initialize empty list
    if log_file.exists():
        with open(log_file, "r") as f:
            try:
                log_data = json.load(f)
            except (json.JSONDecodeError, ValueError):
                log_data = []
    else:
        log_data = []

    # Create log entry with timestamp and duration
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "duration_ms": duration_ms,
        "input_data": input_data,
    }

    # Append the log entry
    log_data.append(log_entry)

    # Write back to file with formatting
    with open(log_file, "w") as f:
        json.dump(log_data, f, indent=2)


def store_last_prompt(session_id, prompt):
    """Store the last prompt for status line display."""
    # Ensure sessions directory exists
    sessions_dir = Path.home() / ".claude/data/sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    # Load or create session file
    session_file = sessions_dir / f"{session_id}.json"

    if session_file.exists():
        try:
            with open(session_file, "r") as f:
                session_data = json.load(f)
        except (json.JSONDecodeError, ValueError):
            session_data = {"session_id": session_id, "prompts": []}
    else:
        session_data = {"session_id": session_id, "prompts": []}

    # Add the new prompt
    session_data["prompts"].append(prompt)

    # Save the updated session data
    try:
        with open(session_file, "w") as f:
            json.dump(session_data, f, indent=2)
    except Exception:
        # Silently fail if we can't write the file
        pass


def main():
    start_time = time.perf_counter()
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser()
        parser.add_argument(
            "--store-last-prompt",
            action="store_true",
            help="Store the last prompt for status line display",
        )
        args = parser.parse_args()

        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())

        # Extract session_id and prompt
        session_id = input_data.get("session_id", "unknown")
        prompt = input_data.get("prompt", "")

        # Store last prompt if requested
        if args.store_last_prompt:
            store_last_prompt(session_id, prompt)

        # Calculate duration in milliseconds
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Log the user prompt
        log_user_prompt(input_data, duration_ms)

        # Success - prompt will be processed
        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)


if __name__ == "__main__":
    main()

