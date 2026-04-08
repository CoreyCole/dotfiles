#!/bin/bash
printf '\033]52;c;%s\a' "$(echo -n 'osc52 works' | base64)"
echo "If Cmd+V pastes 'osc52 works', OSC 52 is working."
