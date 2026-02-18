#!/bin/bash
# Custom install script that disables opencollective postinstall scripts
# This prevents the 'find' command errors during Render deployment

export DISABLE_OPENCOLLECTIVE=1
npm install
exit $?












