#!/bin/bash

./start.sh 1 &
sleep 10
cd webrtc-test && yarn test connectManyandPing.mjs
# kill go server
killall server