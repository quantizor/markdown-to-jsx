#!/bin/bash

for cmd in "$@"; do {
  echo "Process \"$cmd\" started";
  eval $cmd & pid=$!
  PID_LIST+=" $pid";
} done

trap "kill $PID_LIST" SIGINT

echo "Parallel processes have started";

wait $PID_LIST

echo
echo "All processes have completed";
