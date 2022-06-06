#!/bin/bash

./start.sh 20 &
sleep 10
cd webrtc-test && yarn test connectManyandSendMessagesMultiPlexed.mjs
# kill go server
killall server