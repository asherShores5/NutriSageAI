#!/usr/bin/env bash
# Redeploy the macro Lambda from source. Assumes the role + HTTP API already exist
# (created once during initial setup — see README.md). Just packages and pushes code.
set -euo pipefail
cd "$(dirname "$0")"

REGION="${AWS_REGION:-us-east-1}"
FN="nutrisageai-macro"

python -c "import zipfile; z=zipfile.ZipFile('function.zip','w',zipfile.ZIP_DEFLATED); z.write('lambda_function.py'); z.close()"
aws lambda update-function-code --region "$REGION" --function-name "$FN" \
  --zip-file fileb://function.zip --query 'LastUpdateStatus' --output text
aws lambda wait function-updated --region "$REGION" --function-name "$FN"
echo "deployed $FN to $REGION"
