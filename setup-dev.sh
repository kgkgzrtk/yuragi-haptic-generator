#!/bin/bash
# Development environment setup script

echo "Setting up Yuragi Haptic Generator development environment..."

# Create virtual environment
echo "Creating Python virtual environment..."
python -m venv venv

# Activate virtual environment
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install project with dev dependencies
echo "Installing project with development dependencies..."
pip install -e ".[dev,test]"

# Install pre-commit hooks (if using)
if command -v pre-commit &> /dev/null; then
    echo "Setting up pre-commit hooks..."
    pre-commit install
fi

# Setup frontend
echo "Setting up frontend..."
cd frontend
npm install
cd ..

echo "Development environment setup complete!"
echo ""
echo "To activate the environment:"
echo "  source venv/bin/activate    # On Unix/macOS"
echo "  venv\\Scripts\\activate       # On Windows"
echo ""
echo "To run the backend:"
echo "  cd backend && uvicorn src.main:app --reload"
echo ""
echo "To run the frontend:"
echo "  cd frontend && npm start"