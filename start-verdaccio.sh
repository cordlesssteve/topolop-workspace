#!/bin/bash
# Start verdaccio local registry for topolop development

echo "Starting verdaccio on http://localhost:4873"
echo "Press Ctrl+C to stop"
echo ""
echo "To publish: npm publish --workspace @topolop/core"
echo "To install elsewhere: npm install @topolop/core --registry http://localhost:4873"
echo ""

verdaccio
