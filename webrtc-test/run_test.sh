#!/bin/bash

set -x
env TEST_FILE=$1 node_modules/.bin/karma start