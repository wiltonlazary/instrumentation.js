#!/bin/bash
cd $(dirname $0)/../
exec node ./node_modules/gulp/bin/gulp.js compile