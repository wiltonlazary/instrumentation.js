#!/bin/bash
cd $(dirname $0)/../
rm *.tgz &> /dev/null
npm pack