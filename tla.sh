#!/bin/sh

ts=$1
js=`basename $1 .ts`.js
tmp=__tmp.js

deno bundle --no-check $ts $tmp
echo '(async () => {' >> $js
cat $tmp >> $js
echo '})();' >> $js
rm -f $tmp

