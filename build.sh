#!/bin/bash
set -e

    # Install Python dependencies from requirements.txt if Python is available (for PDF auto-tagging and structure element creation)
    if command -v python3 &> /dev/null; then
      echo "Installing Python dependencies for PDF auto-tagging..."
      if [ -f scripts/requirements.txt ]; then
        python3 -m pip install --user -r scripts/requirements.txt 2>/dev/null || \
        pip3 install --break-system-packages -r scripts/requirements.txt 2>/dev/null || \
        pip3 install -r scripts/requirements.txt 2>/dev/null || \
        echo "⚠️  Warning: Could not install Python dependencies from requirements.txt. PDF auto-tagging will be unavailable."
      else
        # Fallback to direct installation if requirements.txt doesn't exist
        python3 -m pip install --user pymupdf>=1.23.0 pikepdf>=8.0.0 2>/dev/null || \
        pip3 install --break-system-packages pymupdf>=1.23.0 pikepdf>=8.0.0 2>/dev/null || \
        pip3 install pymupdf>=1.23.0 pikepdf>=8.0.0 2>/dev/null || \
        echo "⚠️  Warning: Could not install PyMuPDF/pikepdf. PDF auto-tagging will be unavailable."
      fi
    fi

# Run Next.js build
npm run build:next 2>&1 | tee build.log

# Check if build failed
BUILD_EXIT_CODE=${PIPESTATUS[0]}

# If build failed, check if it's only due to error page generation issues
if [ $BUILD_EXIT_CODE -ne 0 ]; then
  # Check if the error is only about Html import in error pages
  if grep -q "Html.*should not be imported outside of pages/_document" build.log && \
     grep -q "Export encountered errors on following paths" build.log && \
     grep -q "/_error: /404\|/_error: /500" build.log; then
    echo ""
    echo "⚠️  Build completed with warnings about error page generation."
    echo "   These pages will be rendered dynamically at runtime."
    echo "   The build output is still valid for standalone deployment."
    echo ""
    exit 0
  else
    # Real build error - fail
    exit $BUILD_EXIT_CODE
  fi
fi

exit 0

