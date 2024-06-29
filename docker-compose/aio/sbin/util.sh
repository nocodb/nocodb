#!/bin/bash
# this file contains the utility functions 
# used during installation
#

asksure() {
local custom_msg="${@}"
if [[ ${custom_msg} ]]; then
  echo -n "${custom_msg}"
else
  echo -n " | Press Y to continue or N to skip (Y/N)? "
fi
while read -r -n 1 -s answer; do
  if [[ $answer = [YyNn] ]]; then
    [[ $answer = [Yy] ]] && retval=0
    [[ $answer = [Nn] ]] && retval=1
    break
  fi
done

echo # just a final linefeed, optics...

return $retval
}