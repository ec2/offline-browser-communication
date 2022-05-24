#!/bin/bash

go run *.go 5000 &
sleep 3
cd webrtc-test && yarn test connectOne.mjs
# kill go server
killall server