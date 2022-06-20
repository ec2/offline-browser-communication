#!/bin/bash

# ./start.sh 5 &
# sleep 10
cd webrtc-test && yarn test connectManyandSendMessagesMultiPlexed.mjs
# kill go server
killall server