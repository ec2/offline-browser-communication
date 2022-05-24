#!/bin/bash

for i in $(eval echo {1..$1}); do {
  echo "Process Server \"$i\" started";
  go run *.go $((5000+i)) & pid=$!
  PID_LIST+=" $pid";
} done

trap "kill $PID_LIST" SIGINT

echo "Parallel processes have started";

wait $PID_LIST

echo
echo "All processes have completed";