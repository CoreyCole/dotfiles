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
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Ensure logs directory exists in .claude directory
        log_dir = Path.home() / ".claude" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "stop_hook.json"

        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Create log entry with timestamp
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "input_data": input_data
        }
        
        # Append new data
        log_data.append(log_entry)
        
        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)


if __name__ == "__main__":
    main()