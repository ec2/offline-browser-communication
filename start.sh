#!/bin/bash
# var for session name (to avoid repeated occurences)
sn=xyz

# Start the session and window 0 in /etc
#   This will also be the default cwd for new windows created
#   via a binding unless overridden with default-path.
tmux new-session -s "$sn" -n etc -d

# Create a bunch of windows in /var/log
for i in {0..20}; do
        tmux new-window -t "$sn:$i" -n "var$i" go run *.go $((5000+$i))
done

# Select window #1 and attach to the session
tmux select-window -t "$sn:1"
tmux -2 attach-session -t "$sn"
