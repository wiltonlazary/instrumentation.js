#!/bin/bash
cd $(dirname $0)/../
./bin/build-compile.sh
rm *.tgz &> /dev/null
npm pack