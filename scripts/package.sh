#!/bin/sh
set -e
node --test
rm -f gh-links-app.zip
zip -r gh-links-app.zip gh-links-app -x '*.DS_Store*'
