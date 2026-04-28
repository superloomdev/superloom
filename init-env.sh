#!/bin/sh
# Initialise the development environment for this project.
# Must be sourced so variables are set in the current shell:
#
#   source init-env.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Select environment:"
echo "  1) dev         — local machine, Docker emulators"
echo "  2) integration — real cloud services (sandbox account), test data"
echo ""
printf "Enter choice [1/2]: "
read ENV_CHOICE

case "$ENV_CHOICE" in
  1)
    ENV_NAME="dev"
    ENV_FILE="$SCRIPT_DIR/__dev__/.env.dev"
    ;;
  2)
    ENV_NAME="integration"
    ENV_FILE="$SCRIPT_DIR/__dev__/.env.integration"
    ;;
  *)
    echo "Invalid choice. Aborting."
    return 1
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "Error: $ENV_FILE not found. See docs/dev/README.md to set up your environment."
  return 1
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
echo ""
echo "[$ENV_NAME] environment loaded from $ENV_FILE"
