#!/bin/bash
# Development environment setup script using uv

echo "Setting up Yuragi Haptic Generator development environment with uv..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "uv is not installed. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create virtual environment with uv
echo "Creating Python virtual environment with uv..."
uv venv

# Activate virtual environment
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

# Install project with dev dependencies using uv
echo "Installing project with development dependencies..."
uv pip install -e ".[dev,test]"

# Install pre-commit hooks (if using)
if command -v pre-commit &> /dev/null; then
    echo "Setting up pre-commit hooks..."
    pre-commit install
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Installing pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
fi

# Setup frontend
echo "Setting up frontend with pnpm..."
cd frontend
pnpm install
cd ..

echo "Development environment setup complete!"
echo ""
echo "To activate the environment:"
echo "  source .venv/bin/activate    # On Unix/macOS"
echo "  .venv\\Scripts\\activate       # On Windows"
echo ""
echo "To run the backend:"
echo "  cd backend && uv run uvicorn src.main:app --reload"
echo ""
echo "To run the frontend:"
echo "  cd frontend && pnpm dev"